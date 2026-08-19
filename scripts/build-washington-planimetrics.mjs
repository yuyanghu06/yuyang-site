import { writeFile } from "node:fs/promises";

const ORIGIN = [-73.99733, 40.73082];
const METERS_PER_LONGITUDE = 111320 * Math.cos((ORIGIN[1] * Math.PI) / 180);
const BOUNDS = { north: 40.738, west: -74.006, south: 40.724, east: -73.988 };
const ROADBED_DATASET = "i36f-5ih7";
const OUTPUT = "public/data/washington-square-planimetrics.json";

function project([longitude, latitude]) {
  return [
    Math.round((longitude - ORIGIN[0]) * METERS_PER_LONGITUDE * 1000) / 1000,
    Math.round(-(latitude - ORIGIN[1]) * 111320 * 1000) / 1000,
  ];
}

function openRing(ring) {
  const points = ring.map(project);
  if (
    points.length > 1
    && points[0][0] === points.at(-1)[0]
    && points[0][1] === points.at(-1)[1]
  ) points.pop();
  return points;
}

function polygons(geometry) {
  if (!geometry) return [];
  if (geometry.type === "Polygon") return [geometry.coordinates];
  if (geometry.type === "MultiPolygon") return geometry.coordinates;
  return [];
}

const where = `within_box(the_geom,${BOUNDS.north},${BOUNDS.west},${BOUNDS.south},${BOUNDS.east})`;
const url = new URL(`https://data.cityofnewyork.us/resource/${ROADBED_DATASET}.geojson`);
url.searchParams.set("$limit", "5000");
url.searchParams.set("$where", where);
const response = await fetch(url);
if (!response.ok) throw new Error(`NYC Roadbed request failed (${response.status})`);
const featureCollection = await response.json();

const roadbeds = [];
for (const feature of featureCollection.features ?? []) {
  for (const polygon of polygons(feature.geometry)) {
    const [outer, ...interiors] = polygon;
    if (!outer || outer.length < 4) continue;
    roadbeds.push({
      sourceId: feature.properties?.source_id ?? null,
      featureCode: feature.properties?.feat_code ?? null,
      ring: openRing(outer),
      holes: interiors.filter((ring) => ring.length >= 4).map(openRing),
    });
  }
}

const payload = {
  source: "NYC Planimetric Database: Roadbed (2022 imagery)",
  sourceUrl: "https://data.cityofnewyork.us/d/i36f-5ih7",
  units: "meters",
  origin: { longitude: ORIGIN[0], latitude: ORIGIN[1] },
  bounds: BOUNDS,
  statistics: { roadbeds: roadbeds.length },
  roadbeds,
};

await writeFile(OUTPUT, JSON.stringify(payload));
console.log(`Wrote ${roadbeds.length} roadbed polygons to ${OUTPUT}`);
