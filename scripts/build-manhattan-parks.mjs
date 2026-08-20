import { writeFile } from "node:fs/promises";

const ORIGIN = [-73.99733, 40.73082];
const METERS_PER_LONGITUDE = 111320 * Math.cos((ORIGIN[1] * Math.PI) / 180);
const BOUNDS = { north: 40.7475, west: -74.019, south: 40.714, east: -73.9755 };
const EXCLUDED_DETAILED_PARKS = ["Washington Square Park", "Union Square Park", "Gramercy Park"];
const GREEN_LEISURE = new Set(["park", "garden", "playground", "pitch", "recreation_ground"]);
const GREEN_LANDUSE = new Set(["grass", "recreation_ground", "village_green"]);

function greenKind(tags) {
  if (GREEN_LEISURE.has(tags.leisure)) return tags.leisure;
  if (GREEN_LANDUSE.has(tags.landuse)) return tags.landuse;
  return null;
}

function project({ lon, lat }) {
  return [Math.round((lon - ORIGIN[0]) * METERS_PER_LONGITUDE * 1000) / 1000, Math.round(-(lat - ORIGIN[1]) * 111320 * 1000) / 1000];
}

function closedRing(geometry) {
  if (!geometry?.length) return null;
  const ring = geometry.map(project);
  if (ring.length < 4) return null;
  if (ring[0][0] !== ring.at(-1)[0] || ring[0][1] !== ring.at(-1)[1]) ring.push([...ring[0]]);
  return ring;
}

function joinOuterMembers(members) {
  const fragments = members.filter((member) => member.type === "way" && member.role === "outer" && member.geometry?.length).map((member) => member.geometry.map(project));
  const rings = [];
  while (fragments.length) {
    const ring = fragments.shift();
    let joined = true;
    while (joined && fragments.length && ring[0].toString() !== ring.at(-1).toString()) {
      joined = false;
      for (let index = 0; index < fragments.length; index += 1) {
        const candidate = fragments[index]; const start = ring[0].toString(); const end = ring.at(-1).toString();
        if (candidate[0].toString() === end) ring.push(...candidate.slice(1));
        else if (candidate.at(-1).toString() === end) ring.push(...candidate.toReversed().slice(1));
        else if (candidate.at(-1).toString() === start) ring.unshift(...candidate.slice(0, -1));
        else if (candidate[0].toString() === start) ring.unshift(...candidate.toReversed().slice(0, -1));
        else continue;
        fragments.splice(index, 1); joined = true; break;
      }
    }
    if (ring.length >= 4 && ring[0].toString() === ring.at(-1).toString()) rings.push(ring);
  }
  return rings;
}

function attributes(source) {
  return Object.fromEntries([...source.matchAll(/([\w:]+)="([^"]*)"/g)].map((match) => [match[1], match[2]]));
}
const boxes = [];
for (let row = 0; row < 4; row += 1) for (let column = 0; column < 4; column += 1) boxes.push([
  BOUNDS.south + (BOUNDS.north - BOUNDS.south) * row / 4,
  BOUNDS.west + (BOUNDS.east - BOUNDS.west) * column / 4,
  BOUNDS.south + (BOUNDS.north - BOUNDS.south) * (row + 1) / 4,
  BOUNDS.west + (BOUNDS.east - BOUNDS.west) * (column + 1) / 4,
]);
const nodes = new Map(); const ways = new Map(); const relations = new Map();
function ingestXml(xml) {
  for (const match of xml.matchAll(/<node\b([^>]*)\/?>(?:[\s\S]*?<\/node>)?/g)) {
    const node = attributes(match[1]); if (node.id && node.lon && node.lat) nodes.set(node.id, { lon: Number(node.lon), lat: Number(node.lat) });
  }
  for (const match of xml.matchAll(/<way\b([^>]*)>([\s\S]*?)<\/way>/g)) {
    const id = attributes(match[1]).id; const body = match[2];
    const tags = Object.fromEntries([...body.matchAll(/<tag\b([^>]*)\/>/g)].map((tag) => { const data = attributes(tag[1]); return [data.k, data.v]; }));
    const refs = [...body.matchAll(/<nd ref="(\d+)"\/>/g)].map((node) => node[1]);
    ways.set(id, { id, tags, refs });
  }
  for (const match of xml.matchAll(/<relation\b([^>]*)>([\s\S]*?)<\/relation>/g)) {
    const id = attributes(match[1]).id;
    if ((relations.get(id)?.length ?? 0) < match[2].length) relations.set(id, match[2]);
  }
}
for (const [south, west, north, east] of boxes) {
  const response = await fetch(`https://api.openstreetmap.org/api/0.6/map?bbox=${west},${south},${east},${north}`, { headers: { "User-Agent": "YuyangSite Manhattan park build (github.com/yuyanghu06)" } });
  if (!response.ok) throw new Error(`OpenStreetMap map request failed (${response.status})`);
  ingestXml(await response.text());
}
// These large parks straddle map-export cells, so fetch their complete OSM
// topology explicitly instead of relying on a partial bbox relation response.
for (const feature of [
  "way/25162896", // Tompkins Square Park
  "relation/7095669", // Stuyvesant Square
  "way/239988120", // Jefferson Market Garden
  "way/30657456", // Christopher Park
  "way/30657462", // Sheridan Square Garden
  "way/22961817", // Jackson Square Park
  "way/471549306", // NYC AIDS Memorial Park at St. Vincent's Triangle
]) {
  const response = await fetch(`https://api.openstreetmap.org/api/0.6/${feature}/full`, { headers: { "User-Agent": "YuyangSite Manhattan park build (github.com/yuyanghu06)" } });
  if (!response.ok) throw new Error(`OpenStreetMap ${feature} request failed (${response.status})`);
  ingestXml(await response.text());
}
const parkRings = []; const paths = [];
for (const way of ways.values()) {
  const tags = way.tags; const geometry = way.refs.map((ref) => nodes.get(ref)).filter(Boolean);
  const kind = greenKind(tags);
  if (kind && !EXCLUDED_DETAILED_PARKS.includes(tags.name) && geometry.length >= 4 && way.refs[0] === way.refs.at(-1)) {
    parkRings.push({ sourceId: way.id, name: tags.name ?? `${kind} ${way.id}`, kind, ring: closedRing(geometry) });
  } else if (["footway", "path", "pedestrian"].includes(tags.highway) && geometry.length >= 2) {
    paths.push({ width: Number.parseFloat(tags.width) || (tags.highway === "pedestrian" ? 5 : 3.2), points: geometry.map(project) });
  }
}
for (const [id, body] of relations) {
  const tags = Object.fromEntries([...body.matchAll(/<tag\b([^>]*)\/>/g)].map((tag) => { const data = attributes(tag[1]); return [data.k, data.v]; }));
  const kind = greenKind(tags);
  if (!kind || EXCLUDED_DETAILED_PARKS.includes(tags.name)) continue;
  const members = [...body.matchAll(/<member\b([^>]*)\/>/g)].map((member) => attributes(member[1])).filter((member) => member.type === "way" && member.role === "outer").map((member) => ({ type: "way", role: "outer", geometry: (ways.get(member.ref)?.refs ?? []).map((ref) => nodes.get(ref)).filter(Boolean) }));
  for (const ring of joinOuterMembers(members)) parkRings.push({ sourceId: id, name: tags.name ?? `${kind} ${id}`, kind, ring });
}
// Explicit art-directed park occupying the user-selected superblock east of
// the AIDS Memorial. Corners are inset from the actual West 11th/West 12th
// and Sixth/Seventh Avenue South intersections to preserve the road edges.
parkRings.push({
  sourceId: "authored-west-11th-faux-park",
  name: "West 11th Street Faux Park",
  kind: "authored-park",
  ring: [[-311, -642], [-86, -514], [-48, -582], [-367, -756], [-311, -642]],
});
await writeFile("public/data/manhattan-parks.json", JSON.stringify({ source: "OpenStreetMap", sourceUrl: "https://www.openstreetmap.org/copyright", license: "ODbL", origin: { longitude: ORIGIN[0], latitude: ORIGIN[1] }, bounds: BOUNDS, statistics: { parks: parkRings.length, paths: paths.length }, parkRings, paths }));
console.log(`Wrote ${parkRings.length} context park rings and ${paths.length} pedestrian paths.`);
