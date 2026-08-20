import { readFile, writeFile } from "node:fs/promises";

const ORIGIN = [-73.99733, 40.73082];
const METERS_PER_LONGITUDE = 111320 * Math.cos((ORIGIN[1] * Math.PI) / 180);
const PARK_BOUNDS = { north: 40.73265, west: -74.001, south: 40.7289, east: -73.99535 };
const MAP_BOUNDS = `${PARK_BOUNDS.west},${PARK_BOUNDS.south},${PARK_BOUNDS.east},${PARK_BOUNDS.north}`;
const OUTPUT = "public/data/washington-square-park.json";
const roadbeds = JSON.parse(await readFile("public/data/washington-square-planimetrics.json", "utf8")).roadbeds;

function pointInRing([x, y], ring) {
  let inside = false;
  for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index, index += 1) {
    const [xi, yi] = ring[index];
    const [xj, yj] = ring[previous];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function isOnRoadbed(point) {
  return roadbeds.some((roadbed) => pointInRing(point, roadbed.ring) && !roadbed.holes.some((hole) => pointInRing(point, hole)));
}

function isNearParkEdge([x, z]) {
  return x < -250 || x > 100 || z < -140 || z > 150;
}

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
  headers: { "User-Agent": "YuyangSite Washington Square study (github.com/yuyanghu06)" },
});
if (!response.ok) throw new Error(`OpenStreetMap map request failed (${response.status})`);
const xml = await response.text();

const nodes = new Map();
const nodeTags = new Map();
for (const match of xml.matchAll(/<node\b([^>]*)\/>/g)) {
  const data = attributes(match[1]);
  nodes.set(data.id, [Number(data.lon), Number(data.lat)]);
}
for (const match of xml.matchAll(/<node\b([^>]*)>([\s\S]*?)<\/node>/g)) {
  const data = attributes(match[1]);
  const tags = Object.fromEntries([...match[2].matchAll(/<tag\b([^>]*)\/>/g)].map((tag) => {
    const values = attributes(tag[1]);
    return [values.k, values.v];
  }));
  nodes.set(data.id, [Number(data.lon), Number(data.lat)]);
  nodeTags.set(data.id, tags);
}

const paths = [];
const crossings = new Map();
let fountain = null;
let arch = null;
for (const match of xml.matchAll(/<way\b([^>]*)>([\s\S]*?)<\/way>/g)) {
  const way = attributes(match[1]);
  const body = match[2];
  const tags = Object.fromEntries([...body.matchAll(/<tag\b([^>]*)\/>/g)].map((tag) => {
    const data = attributes(tag[1]);
    return [data.k, data.v];
  }));
  const nodeRefs = [...body.matchAll(/<nd ref="(\d+)"\/>/g)].map((node) => node[1]);
  const coordinates = nodeRefs.map((node) => nodes.get(node)).filter(Boolean);
  if (coordinates.length < 2) continue;
  const points = coordinates.map(project);

  if (way.id === "248166269") {
    arch = { sourceId: way.id, height: Number(tags.height) || 20.5, footprint: points };
    continue;
  }
  if (tags.amenity === "fountain") {
    fountain = { sourceId: way.id, ring: points };
    continue;
  }
  if (!["footway", "path", "pedestrian"].includes(tags.highway)) continue;
  const centroid = coordinates.reduce((sum, point) => [sum[0] + point[0], sum[1] + point[1]], [0, 0]).map((value) => value / coordinates.length);
  if (centroid[0] < PARK_BOUNDS.west || centroid[0] > PARK_BOUNDS.east || centroid[1] < PARK_BOUNDS.south || centroid[1] > PARK_BOUNDS.north) continue;
  paths.push({
    sourceId: way.id,
    kind: tags.highway,
    width: Number.parseFloat(tags.width) || (tags.highway === "pedestrian" ? 5 : 3.2),
    points,
  });
  nodeRefs.forEach((nodeId, index) => {
    if (nodeTags.get(nodeId)?.highway !== "crossing" || crossings.has(nodeId)) return;
    const coordinate = nodes.get(nodeId);
    const previous = nodes.get(nodeRefs[Math.max(0, index - 1)]);
    const next = nodes.get(nodeRefs[Math.min(nodeRefs.length - 1, index + 1)]);
    if (!coordinate || !previous || !next) return;
    const point = project(coordinate);
    if (!isOnRoadbed(point) || !isNearParkEdge(point)) return;
    const before = project(previous);
    const after = project(next);
    crossings.set(nodeId, {
      sourceId: nodeId,
      point,
      angle: Math.atan2(after[1] - before[1], after[0] - before[0]),
    });
  });
}

const payload = {
  source: "OpenStreetMap",
  sourceUrl: "https://www.openstreetmap.org/copyright",
  license: "ODbL",
  origin: { longitude: ORIGIN[0], latitude: ORIGIN[1] },
  statistics: { paths: paths.length, crossings: crossings.size, hasFountain: Boolean(fountain), hasArch: Boolean(arch) },
  paths,
  crossings: [...crossings.values()],
  fountain,
  arch,
};

await writeFile(OUTPUT, JSON.stringify(payload));
console.log(`Wrote ${paths.length} park paths, ${crossings.size} crossings, fountain=${Boolean(fountain)}, arch=${Boolean(arch)} to ${OUTPUT}`);
