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
  if (tags.leisure === "park" && points.length >= 4) parkRings.push(points);
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
        const end = ring.at(-1).toString();
        if (candidate[0].toString() === end) ring.push(...candidate.slice(1));
        else if (candidate.at(-1).toString() === end) ring.push(...candidate.toReversed().slice(1));
        else continue;
        outerWays.splice(index, 1);
        joined = true;
        break;
      }
    }
    if (ring.length >= 4) parkRings.push(ring);
  }
}

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
