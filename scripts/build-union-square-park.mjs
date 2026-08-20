import { writeFile } from "node:fs/promises";

const ORIGIN = [-73.99733, 40.73082];
const METERS_PER_LONGITUDE = 111320 * Math.cos((ORIGIN[1] * Math.PI) / 180);
// Shared context for the Union Square view extends east through Gramercy Park.
// Gramercy is rendered as surrounding geography, not exposed as a camera view.
const PARK_BOUNDS = { north: 40.7392, west: -73.9927, south: 40.7341, east: -73.9842 };
const MAP_BOUNDS = `${PARK_BOUNDS.west},${PARK_BOUNDS.south},${PARK_BOUNDS.east},${PARK_BOUNDS.north}`;
const OUTPUT = "public/data/union-square-park.json";

function project([longitude, latitude]) {
  return [
    Math.round((longitude - ORIGIN[0]) * METERS_PER_LONGITUDE * 1000) / 1000,
    Math.round(-(latitude - ORIGIN[1]) * 111320 * 1000) / 1000,
  ];
}

function attributes(source) {
  return Object.fromEntries([...source.matchAll(/([\w:]+)="([^"]*)"/g)].map((match) => [match[1], match[2]]));
}

const response = await fetch(`https://api.openstreetmap.org/api/0.6/map?bbox=${MAP_BOUNDS}`, {
  headers: { "User-Agent": "YuyangSite Union and Gramercy context (github.com/yuyanghu06)" },
});
if (!response.ok) throw new Error(`OpenStreetMap map request failed (${response.status})`);
const xml = await response.text();

const nodes = new Map();
for (const match of xml.matchAll(/<node\b([^>]*)\/>/g)) {
  const data = attributes(match[1]);
  nodes.set(data.id, [Number(data.lon), Number(data.lat)]);
}
for (const match of xml.matchAll(/<node\b([^>]*)>[\s\S]*?<\/node>/g)) {
  const data = attributes(match[1]);
  nodes.set(data.id, [Number(data.lon), Number(data.lat)]);
}

const paths = [];
const parkRings = [];
const openParkPoints = [];
const ways = new Map();
for (const match of xml.matchAll(/<way\b([^>]*)>([\s\S]*?)<\/way>/g)) {
  const body = match[2];
  const tags = Object.fromEntries([...body.matchAll(/<tag\b([^>]*)\/>/g)].map((tag) => {
    const data = attributes(tag[1]);
    return [data.k, data.v];
  }));
  const points = [...body.matchAll(/<nd ref="(\d+)"\/>/g)]
    .map((node) => nodes.get(node[1]))
    .filter(Boolean)
    .map(project);
  if (points.length < 2) continue;
  ways.set(attributes(match[1]).id, points);
  // Standalone park ways are already complete rings. Open ways are commonly
  // just one member of a multipolygon relation and must not be triangulated on
  // their own, because the implicit closing edge cuts across the park.
  if (tags.leisure === "park" && points.length >= 4 && points[0].toString() === points.at(-1).toString()) {
    parkRings.push(points);
  } else if (tags.leisure === "park" && points.length >= 4) {
    openParkPoints.push(...points);
  }
  if (!["footway", "path", "pedestrian"].includes(tags.highway)) continue;
  paths.push({
    sourceId: attributes(match[1]).id,
    kind: tags.highway,
    width: Number.parseFloat(tags.width) || (tags.highway === "pedestrian" ? 5 : 3.2),
    points,
  });
}

for (const match of xml.matchAll(/<relation\b[^>]*>([\s\S]*?)<\/relation>/g)) {
  const body = match[1];
  const tags = Object.fromEntries([...body.matchAll(/<tag\b([^>]*)\/>/g)].map((tag) => {
    const data = attributes(tag[1]);
    return [data.k, data.v];
  }));
  if (tags.leisure !== "park" || !["Union Square", "Gramercy Park"].some((name) => tags.name?.includes(name))) continue;
  const outerWays = [...body.matchAll(/<member\b([^>]*)\/>/g)]
    .map((member) => attributes(member[1]))
    .filter((member) => member.type === "way" && member.role === "outer")
    .map((member) => ways.get(member.ref))
    .filter(Boolean);
  while (outerWays.length) {
    const ring = [...outerWays.shift()];
    let joined = true;
    while (joined && outerWays.length && ring[0].toString() !== ring.at(-1).toString()) {
      joined = false;
      for (let index = 0; index < outerWays.length; index += 1) {
        const candidate = outerWays[index];
        const start = ring[0].toString();
        const end = ring.at(-1).toString();
        if (candidate[0].toString() === end) ring.push(...candidate.slice(1));
        else if (candidate.at(-1).toString() === end) ring.push(...candidate.toReversed().slice(1));
        else if (candidate.at(-1).toString() === start) ring.unshift(...candidate.slice(0, -1));
        else if (candidate[0].toString() === start) ring.unshift(...candidate.toReversed().slice(0, -1));
        else continue;
        outerWays.splice(index, 1);
        joined = true;
        break;
      }
    }
    if (ring.length >= 4 && ring[0].toString() === ring.at(-1).toString()) parkRings.push(ring);
    else if (ring.length >= 4) openParkPoints.push(...ring);
  }
}

// Union Square's mapped green is split across several open lawn-edge ways.
// Their outer hull is the visual park boundary requested by this miniature;
// mapped paths and fixtures are rendered separately above the continuous lawn.
function convexHull(points) {
  const unique = [...new Map(points.map((point) => [point.toString(), point])).values()]
    .sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (unique.length < 3) return [];
  const cross = (origin, a, b) => (a[0] - origin[0]) * (b[1] - origin[1]) - (a[1] - origin[1]) * (b[0] - origin[0]);
  const lower = [];
  for (const point of unique) {
    while (lower.length >= 2 && cross(lower.at(-2), lower.at(-1), point) <= 0) lower.pop();
    lower.push(point);
  }
  const upper = [];
  for (const point of unique.toReversed()) {
    while (upper.length >= 2 && cross(upper.at(-2), upper.at(-1), point) <= 0) upper.pop();
    upper.push(point);
  }
  const hull = [...lower.slice(0, -1), ...upper.slice(0, -1)];
  return [...hull, hull[0]];
}

const unionSquareRing = convexHull(openParkPoints.filter(([x]) => x < 800));
if (unionSquareRing.length >= 4) parkRings.push(unionSquareRing);

const payload = {
  source: "OpenStreetMap",
  sourceUrl: "https://www.openstreetmap.org/copyright",
  license: "ODbL",
  origin: { longitude: ORIGIN[0], latitude: ORIGIN[1] },
  statistics: { paths: paths.length, parkRings: parkRings.length },
  paths,
  crossings: [],
  fountain: null,
  arch: null,
  parkRings,
};

await writeFile(OUTPUT, JSON.stringify(payload));
console.log(`Wrote ${paths.length} paths and ${parkRings.length} park rings to ${OUTPUT}`);
