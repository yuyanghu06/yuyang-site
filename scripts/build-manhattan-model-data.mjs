import { readFileSync, writeFileSync } from "node:fs";

const source = JSON.parse(readFileSync(process.argv[2], "utf8"));
const boroughs = JSON.parse(readFileSync(process.argv[3], "utf8"));
const corridor = JSON.parse(readFileSync("public/data/nyc-lower-manhattan.json", "utf8"));
const origin = [-73.9942, 40.7322];
const metersPerLongitude = 111320 * Math.cos((origin[1] * Math.PI) / 180);

function project([longitude, latitude]) {
  return [
    Math.round((longitude - origin[0]) * metersPerLongitude * 10) / 10,
    Math.round((latitude - origin[1]) * 111320 * 10) / 10,
  ];
}

function polygons(geometry) {
  if (!geometry) return [];
  if (geometry.type === "Polygon") return [geometry.coordinates];
  if (geometry.type === "MultiPolygon") return geometry.coordinates;
  return [];
}

const overview = [];
const detail = [];
const manhattan = boroughs.features.find((feature) => feature.properties?.borocode === "1");
const land = polygons(manhattan?.geometry).map((polygon) => {
  const ring = polygon[0] ?? [];
  return ring.filter((_, index) => index % 3 === 0 || index === ring.length - 1).map(project);
});

for (const feature of source.features) {
  const bin = String(feature.properties?.bin ?? "");
  if (!bin.startsWith("1")) continue;
  const height = Math.max(3, Math.min(320, Number(feature.properties?.height_roof) || 12));

  for (const polygon of polygons(feature.geometry)) {
    const outer = polygon[0];
    if (!outer || outer.length < 4) continue;
    const projected = outer.map(project);
    const xs = projected.map((point) => point[0]);
    const ys = projected.map((point) => point[1]);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const centerLongitude = outer.reduce((sum, point) => sum + point[0], 0) / outer.length;
    const centerLatitude = outer.reduce((sum, point) => sum + point[1], 0) / outer.length;
    const isDetail = centerLongitude > -74.006 && centerLongitude < -73.983 && centerLatitude > 40.723 && centerLatitude < 40.741;
    if (isDetail) {
      detail.push({ footprint: projected, height: Math.round(height * 10) / 10 });
    } else {
      overview.push([
        Math.round(((minX + maxX) / 2) * 10) / 10,
        Math.round(((minY + maxY) / 2) * 10) / 10,
        Math.max(2, Math.round((maxX - minX) * 10) / 10),
        Math.max(2, Math.round((maxY - minY) * 10) / 10),
        Math.round(height * 10) / 10,
      ]);
    }
  }
}

const output = {
  source: "NYC Open Data Building Footprints and © OpenStreetMap contributors",
  sourceUrls: [
    "https://data.cityofnewyork.us/d/5zhs-2jue",
    "https://www.openstreetmap.org/copyright",
  ],
  generatedAt: new Date().toISOString(),
  origin,
  land,
  overview,
  detail,
  roads: corridor.roads,
};

writeFileSync("public/data/manhattan-model.json", JSON.stringify(output));
console.log(`Wrote ${overview.length} overview buildings, ${detail.length} detailed buildings, and ${corridor.roads.length} roads.`);
