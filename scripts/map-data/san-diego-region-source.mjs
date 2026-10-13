/** Acquire a reduced, attributed OSM snapshot; ordinary builds are offline. */
import fs from "node:fs/promises";
import { gzipSync, gunzipSync } from "node:zlib";

export const REGION = { west: -117.292, south: 32.864, east: -117.07, north: 33.007 };
export const SNAPSHOT = "public/data/san-diego/region-source.osm.json.gz";
const CACHE = "/tmp/yuyang-san-diego-region";
const allowed = /^(building(?::.*)?|height|min_height|name|highway|landuse|leisure|natural|water|waterway|amenity|sport|surface|layer|bridge|lanes|oneway|width|type|place)$/;
function attributes(text) {
  const decode = (v) => v.replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
  return Object.fromEntries([...text.matchAll(/([\w:]+)="([^"]*)"/g)].map((m) => [m[1], decode(m[2])]));
}
function parseTile(xml) {
  const nodes = new Map(); const elements = [];
  const tagsIn = (body) => Object.fromEntries([...body.matchAll(/<tag\b([^>]*)\/>/g)].map((m) => { const a = attributes(m[1]); return [a.k, a.v]; }).filter(([key]) => allowed.test(key)));
  for (const m of xml.matchAll(/<node\b([^>]*?)(?:\/>|>([\s\S]*?)<\/node>)/g)) {
    const a = attributes(m[1]); const coordinate = { lat: Number(a.lat), lon: Number(a.lon) }; nodes.set(a.id, coordinate);
    const tags = tagsIn(m[2] ?? "");
    if (tags.natural === "tree" || tags.waterway === "waterfall" || tags.place) elements.push({ type: "node", id: Number(a.id), tags, ...coordinate });
  }
  for (const type of ["way", "relation"]) {
    const regex = new RegExp(`<${type}\\b([^>]*)>([\\s\\S]*?)<\\/${type}>`, "g");
    for (const m of xml.matchAll(regex)) {
      const a = attributes(m[1]); const tags = tagsIn(m[2]);
      if (type === "way") {
        const geometry = [...m[2].matchAll(/<nd ref="(\d+)"\/>/g)].map((n) => nodes.get(n[1]));
        if (geometry.length > 1 && geometry.every(Boolean)) elements.push({ type, id: Number(a.id), tags, geometry });
      } else if (tags.type === "multipolygon" && ["landuse", "natural", "leisure", "water", "waterway"].some((k) => tags[k])) {
        const members = [...m[2].matchAll(/<member\b([^>]*)\/>/g)].map((n) => attributes(n[1])).filter((n) => n.type === "way");
        elements.push({ type, id: Number(a.id), tags, members });
      }
    }
  }
  return elements;
}
export async function loadRegionSource(refresh = false) {
  if (!refresh) {
    try { return JSON.parse(gunzipSync(await fs.readFile(SNAPSHOT))); }
    catch (error) { if (error.code !== "ENOENT") throw error; }
  }
  if (refresh) await fs.rm(CACHE, { recursive: true, force: true });
  await fs.mkdir(CACHE, { recursive: true });
  const tiles = []; const cols = 9; const rows = 6;
  for (let row = 0; row < rows; row++) for (let col = 0; col < cols; col++) {
    const west = REGION.west + (REGION.east - REGION.west) * col / cols;
    const south = REGION.south + (REGION.north - REGION.south) * row / rows;
    const east = REGION.west + (REGION.east - REGION.west) * (col + 1) / cols;
    const north = REGION.south + (REGION.north - REGION.south) * (row + 1) / rows;
    tiles.push({ key: `${row}-${col}`, bbox: [west, south, east, north].map((v) => v.toFixed(7)).join(",") });
  }
  const map = new Map(); const acquiredBounds = [];
  async function readTile(tile, depth = 0, attempt = 0) {
    const file = `${CACHE}/${tile.key}.osm`; let xml;
    try { xml = await fs.readFile(file, "utf8"); } catch { /* Download below. */ }
    if (!xml) {
      const url = `https://api.openstreetmap.org/api/0.6/map?bbox=${tile.bbox}`;
      const response = await fetch(url, { signal: AbortSignal.timeout(90000), headers: { "User-Agent": "YuyangSite geographic map study" } });
      if (!response.ok) {
        const error = await response.text();
        if ([429, 509, 502, 503, 504].includes(response.status) && attempt < 8) {
          const seconds = Math.min(60, Math.max(10, Number(error.match(/(\d+) seconds/)?.[1]) || 30));
          console.log(`OSM export asks for a ${seconds}s pause (${tile.key}).`);
          await new Promise((resolve) => setTimeout(resolve, seconds * 1000 + 500));
          return readTile(tile, depth, attempt + 1);
        }
        if (response.status === 400 && error.includes("too many nodes") && depth < 5) {
          const [w, s, e, n] = tile.bbox.split(",").map(Number); const middle = (w + e) / 2;
          const left = await readTile({ key: `${tile.key}a`, bbox: [w, s, middle, n].join(",") }, depth + 1);
          const right = await readTile({ key: `${tile.key}b`, bbox: [middle, s, e, n].join(",") }, depth + 1);
          return [...left, ...right];
        }
        throw new Error(`OSM tile ${tile.key}: HTTP ${response.status} ${error}`);
      }
      xml = await response.text(); await fs.writeFile(file, xml);
    }
    acquiredBounds.push(tile.bbox);
    return parseTile(xml);
  }
  // Two bounded requests at a time avoid stressing the public map export API.
  for (let start = 0; start < tiles.length; start += 2) {
    const results = await Promise.all(tiles.slice(start, start + 2).map((tile) => readTile(tile)));
    for (const elements of results) for (const element of elements) map.set(`${element.type}/${element.id}`, element);
    console.log(`OSM region tiles ${Math.min(start + 2, tiles.length)}/${tiles.length}; ${map.size} unique records`);
  }
  const memberIds = new Set([...map.values()].filter((f) => f.type === "relation").flatMap((f) => f.members.map((m) => Number(m.ref))));
  const elements = [...map.values()].filter((f) => f.type !== "way" || memberIds.has(f.id) || ["building", "highway", "waterway", "water", "natural", "landuse", "leisure", "amenity"].some((k) => f.tags[k])).sort((a, b) => a.type.localeCompare(b.type) || a.id - b.id);
  const source = { version: 1, license: "ODbL-1.0", attribution: "© OpenStreetMap contributors", sourceUrl: "https://api.openstreetmap.org/api/0.6/map", retrievedAt: new Date().toISOString(), bounds: REGION, tileBounds: acquiredBounds.sort(), reduction: "Deduplicated OSM feature IDs; only map geometry and relevant public geographic tags retained. No inferred features in this snapshot.", elements };
  await fs.writeFile(SNAPSHOT, gzipSync(JSON.stringify(source), { level: 9 }));
  return source;
}
