import { readFileSync, writeFileSync } from "node:fs";

const input = JSON.parse(readFileSync(process.argv[2], "utf8"));
const nodes = new Map();
const origin = [-73.9942, 40.7322];
const metersPerLongitude = 111320 * Math.cos((origin[1] * Math.PI) / 180);

for (const element of input.elements) {
  if (element.type === "node") nodes.set(element.id, [element.lon, element.lat]);
}

function project([longitude, latitude]) {
  return [
    Math.round((longitude - origin[0]) * metersPerLongitude * 10) / 10,
    Math.round((latitude - origin[1]) * 111320 * 10) / 10,
  ];
}

function numberFromTag(value) {
  if (!value) return undefined;
  const match = String(value).replace(",", ".").match(/[\d.]+/);
  if (!match) return undefined;
  const number = Number(match[0]);
  if (!Number.isFinite(number)) return undefined;
  return /ft|feet|'/.test(value) ? number * 0.3048 : number;
}

const buildings = [];
const roads = [];

for (const element of input.elements) {
  if (element.type !== "way" || !element.nodes) continue;
  const coordinates = element.nodes.map((id) => nodes.get(id)).filter(Boolean);
  if (coordinates.length < 2) continue;

  if (element.tags?.building && coordinates.length >= 4) {
    const directHeight = numberFromTag(element.tags.height);
    const levels = numberFromTag(element.tags["building:levels"]);
    const height = Math.max(3, Math.min(260, directHeight ?? (levels ? levels * 3 : 12)));
    buildings.push({
      id: element.id,
      footprint: coordinates.map(project),
      height: Math.round(height * 10) / 10,
      kind: element.tags.building,
      name: element.tags.name,
    });
  } else if (element.tags?.highway) {
    roads.push({
      id: element.id,
      path: coordinates.map(project),
      kind: element.tags.highway,
      name: element.tags.name,
    });
  }
}

const output = {
  source: "© OpenStreetMap contributors",
  sourceUrl: "https://www.openstreetmap.org/copyright",
  generatedAt: new Date().toISOString(),
  origin,
  buildings,
  roads,
};

writeFileSync("public/data/nyc-lower-manhattan.json", JSON.stringify(output));
console.log(`Wrote ${buildings.length} buildings and ${roads.length} roads.`);
