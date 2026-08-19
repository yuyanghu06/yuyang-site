import { writeFile } from "node:fs/promises";

const ORIGIN = [-73.99733, 40.73082];
const METERS_PER_LONGITUDE = 111320 * Math.cos((ORIGIN[1] * Math.PI) / 180);
const PARK_BOUNDS = { north: 40.73265, west: -74.001, south: 40.7289, east: -73.99535 };
const MAP_BOUNDS = `${PARK_BOUNDS.west},${PARK_BOUNDS.south},${PARK_BOUNDS.east},${PARK_BOUNDS.north}`;
const OUTPUT = "public/data/washington-square-park.json";

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
for (const match of xml.matchAll(/<node\b([^>]*)\/>/g)) {
  const data = attributes(match[1]);
  nodes.set(data.id, [Number(data.lon), Number(data.lat)]);
}

const paths = [];
let fountain = null;
let arch = null;
for (const match of xml.matchAll(/<way\b([^>]*)>([\s\S]*?)<\/way>/g)) {
  const way = attributes(match[1]);
  const body = match[2];
  const tags = Object.fromEntries([...body.matchAll(/<tag\b([^>]*)\/>/g)].map((tag) => {
    const data = attributes(tag[1]);
    return [data.k, data.v];
  }));
  const coordinates = [...body.matchAll(/<nd ref="(\d+)"\/>/g)].map((node) => nodes.get(node[1])).filter(Boolean);
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
}

const payload = {
  source: "OpenStreetMap",
  sourceUrl: "https://www.openstreetmap.org/copyright",
  license: "ODbL",
  origin: { longitude: ORIGIN[0], latitude: ORIGIN[1] },
  statistics: { paths: paths.length, hasFountain: Boolean(fountain), hasArch: Boolean(arch) },
  paths,
  fountain,
  arch,
};

await writeFile(OUTPUT, JSON.stringify(payload));
console.log(`Wrote ${paths.length} park paths, fountain=${Boolean(fountain)}, arch=${Boolean(arch)} to ${OUTPUT}`);
