/**
 * Static Torrey Highlands scene. Run from the repository root:
 *   node scripts/map-data/build-san-diego.mjs [--refresh]
 * The pinned, ignored Map3D checkout supplies its actual areaData implementation.
 * The checked-in OSM snapshot makes ordinary regeneration network-independent.
 */
import fs from "node:fs/promises";
import { execFileSync } from "node:child_process";
import crypto from "node:crypto";
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { GLTFExporter } from "three/addons/exporters/GLTFExporter.js";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS, EXTMeshoptCompression } from "@gltf-transform/extensions";
import { dedup, prune, quantize, reorder, weld } from "@gltf-transform/functions";
import { MeshoptEncoder } from "meshoptimizer";

const UPSTREAM = "data/work/map3d";
const COMMIT = "2c5d732477ba7c55995572aae926bf80303c00b9";
const DATA = "public/data/san-diego";
const MODEL = "public/models/san-diego/torrey-highlands.glb";
const ORIGIN = [-117.1518, 32.9606];
// Extend the geography around the unchanged authored camera. North/west include
// a small allowance for diagonal overview yaw on the widest desktop viewport.
const BOUNDS = { west: -117.167, south: 32.948, east: -117.13425, north: 32.9755 };
const M_PER_LAT = 111320;
const M_PER_LON = M_PER_LAT * Math.cos(ORIGIN[1] * Math.PI / 180);
const project = (lat, lon) => new THREE.Vector2((lon - ORIGIN[0]) * M_PER_LON, (lat - ORIGIN[1]) * M_PER_LAT);
const point = ({ lat, lon }) => { const v = project(lat, lon); return [v.x, -v.y]; };
const rounded = (values) => values.map((n) => Math.round(n * 1000) / 1000);
const limits = { minX: (BOUNDS.west - ORIGIN[0]) * M_PER_LON, maxX: (BOUNDS.east - ORIGIN[0]) * M_PER_LON, minZ: -(BOUNDS.north - ORIGIN[1]) * M_PER_LAT, maxZ: -(BOUNDS.south - ORIGIN[1]) * M_PER_LAT };
const sourcePath = `${DATA}/source.osm.json`;
await fs.mkdir(DATA, { recursive: true });
await fs.mkdir("public/models/san-diego", { recursive: true });
try { await fs.access(`${UPSTREAM}/src/three/Space.tsx`); }
catch {
  execFileSync("git", ["clone", "https://github.com/cartesiancs/map3d", UPSTREAM], { stdio: "inherit" });
  execFileSync("git", ["-C", UPSTREAM, "checkout", "--detach", COMMIT], { stdio: "inherit" });
}
const upstreamCommit = execFileSync("git", ["-C", UPSTREAM, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
if (upstreamCommit !== COMMIT) throw new Error(`Map3D must be at ${COMMIT}; found ${upstreamCommit}`);
execFileSync("git", ["check-ignore", `${UPSTREAM}/src/three/Space.tsx`]);

function attributes(text) {
  const decode = (v) => v.replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
  return Object.fromEntries([...text.matchAll(/([\w:]+)="([^"]*)"/g)].map((m) => [m[1], decode(m[2])]));
}
function parseOsm(xml) {
  const nodes = new Map(); const elements = [];
  const tagsIn = (body) => Object.fromEntries([...body.matchAll(/<tag\b([^>]*)\/>/g)].map((m) => { const a = attributes(m[1]); return [a.k, a.v]; }));
  for (const m of xml.matchAll(/<node\b([^>]*?)(?:\/>|>([\s\S]*?)<\/node>)/g)) {
    const a = attributes(m[1]); const coordinate = { lat: Number(a.lat), lon: Number(a.lon) }; nodes.set(a.id, coordinate);
    const tags = tagsIn(m[2] ?? "");
    if (tags.natural === "tree" || a.id === "12122650419") elements.push({ type: "node", id: Number(a.id), tags, ...coordinate });
  }
  const allowedTags = /^(building(?::.*)?|height|min_height|name|highway|landuse|leisure|natural|amenity|sport|surface|layer|bridge|lanes|oneway|width|addr:.*|type)$/;
  for (const type of ["way", "relation"]) {
    const regex = new RegExp(`<${type}\\b([^>]*)>([\\s\\S]*?)<\\/${type}>`, "g");
    for (const m of xml.matchAll(regex)) {
      const a = attributes(m[1]); const tags = Object.fromEntries(Object.entries(tagsIn(m[2])).filter(([k]) => allowedTags.test(k)));
      // Untagged ways may be multipolygon boundaries (reserve and track holes).
      if (!Object.keys(tags).length && type !== "way") continue;
      if (type === "way") {
        const geometry = [...m[2].matchAll(/<nd ref="(\d+)"\/>/g)].map((n) => nodes.get(n[1]));
        if (geometry.length < 2 || geometry.some((p) => !p)) continue;
        elements.push({ type, id: Number(a.id), tags, geometry });
      } else if (tags.type === "multipolygon") {
        const members = [...m[2].matchAll(/<member\b([^>]*)\/>/g)].map((n) => attributes(n[1]));
        elements.push({ type, id: Number(a.id), tags, members });
      }
    }
  }
  return elements;
}
function coversBounds(bounds, requested = BOUNDS) {
  return bounds && [bounds.west, bounds.south, bounds.east, bounds.north].every(Number.isFinite)
    && bounds.west <= requested.west && bounds.south <= requested.south
    && bounds.east >= requested.east && bounds.north >= requested.north;
}
let cachedSource;
try { cachedSource = JSON.parse(await fs.readFile(sourcePath, "utf8")); }
catch (error) { if (error.code !== "ENOENT") throw error; }
const refresh = process.argv.includes("--refresh");
let source = refresh ? undefined : cachedSource;
if (source && !coversBounds(source.bounds)) {
  throw new Error("Cached San Diego source bounds do not cover the requested geography. Run npm run data:san-diego -- --refresh to acquire the expanded OSM source.");
}
if (!source) {
  let xml;
  let fallbackBounds;
  if (!refresh) {
    try {
      const candidate = await fs.readFile(`${UPSTREAM}/san-diego-source.osm`, "utf8");
      const tag = candidate.match(/<bounds\b([^>]*)\/>/);
      const a = tag ? attributes(tag[1]) : {};
      const bounds = { west: Number(a.minlon), south: Number(a.minlat), east: Number(a.maxlon), north: Number(a.maxlat) };
      if (coversBounds(bounds)) { xml = candidate; fallbackBounds = bounds; }
    } catch { /* Missing or undersized fallback downloads below. */ }
  }
  const exports = [];
  if (xml) exports.push({ sourceUrl: `${UPSTREAM}/san-diego-source.osm`, bounds: fallbackBounds, xml });
  else {
    // Smaller map API requests avoid its bounding-box area/download limits.
    const midLon = (BOUNDS.west + BOUNDS.east) / 2, midLat = (BOUNDS.south + BOUNDS.north) / 2;
    for (const [west, east] of [[BOUNDS.west, midLon], [midLon, BOUNDS.east]]) {
      for (const [south, north] of [[BOUNDS.south, midLat], [midLat, BOUNDS.north]]) {
        const bounds = { west, south, east, north };
        const sourceUrl = `https://api.openstreetmap.org/api/0.6/map?bbox=${west},${south},${east},${north}`;
        const response = await fetch(sourceUrl, { signal: AbortSignal.timeout(60000), headers: { "User-Agent": "YuyangSite San Diego map study" } });
        if (!response.ok) throw new Error(`OSM export failed (${sourceUrl}): ${response.status} ${await response.text()}`);
        exports.push({ sourceUrl, bounds, retrievedAt: new Date().toISOString(), xml: await response.text() });
      }
    }
  }
  // Parse tiles together: relation boundary ways can refer to nodes in another
  // tile. Deduplicate their repeated feature IDs before model generation.
  const features = new Map();
  for (const f of parseOsm(exports.map((entry) => entry.xml).join("\n"))) {
    const id = `${f.type}/${f.id}`;
    if (!features.has(id)) features.set(id, f);
  }
  source = { license: "ODbL-1.0", attribution: "© OpenStreetMap contributors", sourceUrl: exports[0].sourceUrl, sourceExports: exports.map(({ xml: _xml, ...entry }) => entry), retrievedAt: new Date().toISOString(), bounds: BOUNDS, elements: [...features.values()] };
  if (cachedSource && coversBounds(BOUNDS, cachedSource.bounds) && !coversBounds(cachedSource.bounds)) {
    // Coverage expansion preserves the reviewed center, including entire ways
    // that cross its old boundary. Append actual mapped perimeter features.
    const retainedIds = new Set(cachedSource.elements.map((f) => `${f.type}/${f.id}`));
    const additions = source.elements.filter((f) => !retainedIds.has(`${f.type}/${f.id}`))
      .sort((a, b) => a.type.localeCompare(b.type, "en") || a.id - b.id);
    source.provenance = {
      strategy: "Retain the original snapshot records and order; append new feature IDs from the expanded OSM export, sorted by type and ID. Original records win for overlapping IDs so reviewed geometry remains unchanged.",
      retainedSnapshot: { sourceUrl: cachedSource.sourceUrl, retrievedAt: cachedSource.retrievedAt, bounds: cachedSource.bounds, elements: cachedSource.elements.length, ...(cachedSource.provenance ? { provenance: cachedSource.provenance } : {}) },
      expandedSnapshot: { sourceExports: source.sourceExports, retrievedAt: source.retrievedAt, bounds: source.bounds, elements: source.elements.length, appendedElements: additions.length },
    };
    source.elements = [...cachedSource.elements, ...additions];
  }
  await fs.writeFile(sourcePath, JSON.stringify(source));
}

// Execute the upstream function, without React/UI wrappers. Only the projection
// and the explicit missing-height inputs are supplied by this site's adapter.
const upstream = await fs.readFile(`${UPSTREAM}/src/three/Space.tsx`, "utf8");
const areaStart = upstream.indexOf("    areas.forEach((bld: any) => {");
const areaEnd = upstream.indexOf("    return result;", areaStart);
if (areaStart < 0 || areaEnd < 0) throw new Error("Pinned Map3D areaData function is missing");
const areaData = new Function("THREE", "areas", "project", `const result=[];\n${upstream.slice(areaStart, areaEnd).replaceAll(": any", "")}\nreturn result;`);
const allWays = source.elements.filter((f) => f.type === "way");
const wayById = new Map(allWays.map((f) => [f.id, f]));
const sourceId = (f) => `${f.type}/${f.id}`;
const cleanRing = (ring) => {
  const result = ring.filter((p, i) => !i || Math.hypot(p[0] - ring[i - 1][0], p[1] - ring[i - 1][1]) > 0.01);
  if (result.length > 1 && Math.hypot(result[0][0] - result.at(-1)[0], result[0][1] - result.at(-1)[1]) < 0.01) result.pop();
  return result;
};
const centroid = (ring) => ring.reduce((a, p) => [a[0] + p[0] / ring.length, a[1] + p[1] / ring.length], [0, 0]);
function inside([x, z], ring) {
  let value = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, zi] = ring[i]; const [xj, zj] = ring[j];
    if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) value = !value;
  }
  return value;
}
function segmentDistance(p, a, b) {
  const dx = b[0] - a[0], dz = b[1] - a[1];
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / (dx * dx + dz * dz || 1)));
  return Math.hypot(p[0] - a[0] - dx * t, p[1] - a[1] - dz * t);
}
function nearRing(p, ring, margin) {
  return inside(p, ring) || ring.some((a, i) => segmentDistance(p, a, ring[(i + 1) % ring.length]) < margin);
}
function clipRing(input) {
  let output = cleanRing(input);
  for (const [axis, limit, sign] of [[0, limits.minX, 1], [0, limits.maxX, -1], [1, limits.minZ, 1], [1, limits.maxZ, -1]]) {
    const ring = output; output = [];
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i], b = ring[(i + 1) % ring.length];
      const ain = sign * (a[axis] - limit) >= 0, bin = sign * (b[axis] - limit) >= 0;
      if (ain) output.push(a);
      if (ain !== bin) { const t = (limit - a[axis]) / (b[axis] - a[axis]); output.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]); }
    }
  }
  return cleanRing(output);
}
const inBounds = ([x, z], margin = 0) => x >= limits.minX + margin && x <= limits.maxX - margin && z >= limits.minZ + margin && z <= limits.maxZ - margin;
// Broad sage terrain and dry coastal greens keep undeveloped parcels distinct
// from paved areas. Warm stucco and terracotta add color without changing data.
const palette = {
  ground: "#9fb77f", road: "#797d73", freeway: "#747c77", walk: "#e3d8ba",
  park: "#83a96d", scrub: "#b0b982", meadow: "#b4c285", campus: "#dfd1ae",
  parking: "#a4a28e", pitch: "#6d9e62", track: "#c08b71", water: "#82b6b9",
  wall: ["#e2cdab", "#d9c19e", "#ecddbd", "#d5c9a7", "#e5cdb3"],
  roof: ["#b77f61", "#c58b68", "#b49673", "#cf9c79"],
  campusWall: "#e7d6b4", landmarkRoof: "#ca9970",
  leaf: ["#628c54", "#7e9e5d", "#9aaf6a", "#72956a"],
  trunk: "#91795c", window: "#769ca0",
};
const scene = new THREE.Group(); scene.name = "San Diego · Torrey Highlands";
const batches = new Map();
function add(geometry, color, batch = "terrain") {
  const g = geometry.index ? geometry.toNonIndexed() : geometry;
  g.deleteAttribute("uv");
  if (!g.getAttribute("normal")) g.computeVertexNormals();
  const c = new THREE.Color(color); const colors = new Float32Array(g.getAttribute("position").count * 3);
  for (let i = 0; i < colors.length; i += 3) { colors[i] = c.r; colors[i + 1] = c.g; colors[i + 2] = c.b; }
  g.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  if (!batches.has(batch)) batches.set(batch, []);
  batches.get(batch).push(g);
}
function flat(ring, color, y = 0.1, batch = "terrain", holes = []) {
  if (ring.length < 3) return;
  const shape = new THREE.Shape(ring.map(([x, z]) => new THREE.Vector2(x, -z)));
  for (const hole of holes) shape.holes.push(new THREE.Path(hole.map(([x, z]) => new THREE.Vector2(x, -z))));
  const geometry = new THREE.ShapeGeometry(shape); geometry.rotateX(-Math.PI / 2); geometry.translate(0, y, 0); add(geometry, color, batch);
}
function box(x, y, z, width, height, depth, color, batch, angle = 0) {
  const g = new THREE.BoxGeometry(width, height, depth); g.rotateY(angle); g.translate(x, y, z); add(g, color, batch);
}
const ground = new THREE.PlaneGeometry(limits.maxX - limits.minX, limits.maxZ - limits.minZ); ground.rotateX(-Math.PI / 2); ground.translate((limits.minX + limits.maxX) / 2, -0.03, (limits.minZ + limits.maxZ) / 2); add(ground, palette.ground);
const campus = wayById.get(61862546); const plaza = wayById.get(61862581);
const mesaVerde = wayById.get(61861106); const deerCanyon = wayById.get(61861114);
if (!campus || !plaza || !mesaVerde || !deerCanyon) throw new Error("Required OSM landmark areas are missing");
const landmarkAreas = [
  { id: "mesa-verde-middle-school", name: "Mesa Verde Middle School", feature: mesaVerde, ring: cleanRing(mesaVerde.geometry.map(point)), sourceIds: [] },
  { id: "deer-canyon-elementary-school", name: "Deer Canyon Elementary School", feature: deerCanyon, ring: cleanRing(deerCanyon.geometry.map(point)), sourceIds: [] },
  { id: "westview-high-school", name: "Westview High School", feature: campus, ring: cleanRing(campus.geometry.map(point)), address: "13500 Camino Del Sur, San Diego, CA 92129", sourceIds: [] },
  { id: "torrey-highlands-plaza", name: "Torrey Highlands Plaza", feature: plaza, ring: cleanRing(plaza.geometry.map(point)), address: "7845 Highlands Village Place, San Diego, CA 92129 (Chef Zhu, C101)", sourceIds: [] },
];


// School details are artistic approximations on mapped footprints, not a new
// architectural survey. Keep every detail in its school's merged root.
const schoolAreas = landmarkAreas.filter((area) => [61861106, 61861114].includes(area.feature.id));
const schoolPalette = { wall: "#eadfc7", roofs: ["#a99b83", "#b2a08a", "#a99380"], trim: "#f2e6cc", window: "#718c8d", accent: "#b4ac8c", vent: "#8e9388", court: "#97aaa0", play: "#c5b38d", line: "#f0e7cf", canopy: "#a9ae8c" };
const schoolDetails = schoolAreas.map((area) => ({ id: area.id, name: area.name, campusSourceId: sourceId(area.feature), batch: area.name, buildings: [], surfaces: [], structures: [] }));
const schoolDetailFor = (area) => schoolDetails.find((detail) => detail.id === area.id);
const edges = (ring) => ring.map((a, i) => [a, ring[(i + 1) % ring.length]]);
function segmentsIntersect(a, b, c, d) {
  const cross = (p, q, r) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
  const values = [cross(a, b, c), cross(a, b, d), cross(c, d, a), cross(c, d, b)];
  if (values[0] * values[1] < 0 && values[2] * values[3] < 0) return true;
  return [[c, a, b, values[0]], [d, a, b, values[1]], [a, c, d, values[2]], [b, c, d, values[3]]]
    .some(([p, x, y, v]) => Math.abs(v) < 1e-7 && segmentDistance(p, x, y) < 1e-7);
}
function ringContained(inner, outer, clearance = 0) {
  // Corner-only tests miss a rectangle crossing a concave roof notch.
  return inner.every((p) => inside(p, outer)) && edges(inner).every(([a, b]) => edges(outer).every(([c, d]) =>
    !segmentsIntersect(a, b, c, d) && Math.min(segmentDistance(a, c, d), segmentDistance(b, c, d), segmentDistance(c, a, b), segmentDistance(d, a, b)) >= clearance));
}
function ringsOverlap(a, b, clearance = 0) {
  return a.some((p) => inside(p, b)) || b.some((p) => inside(p, a)) || edges(a).some(([p, q]) => edges(b).some(([r, s]) =>
    segmentsIntersect(p, q, r, s) || Math.min(segmentDistance(p, r, s), segmentDistance(q, r, s), segmentDistance(r, p, q), segmentDistance(s, p, q)) < clearance));
}
function rectangle(x, z, width, depth, angle = 0) {
  return [[-width / 2, -depth / 2], [width / 2, -depth / 2], [width / 2, depth / 2], [-width / 2, depth / 2]]
    .map(([u, v]) => [x + Math.cos(angle) * u + Math.sin(angle) * v, z - Math.sin(angle) * u + Math.cos(angle) * v]);
}
function schoolFacades(area, feature, ring, height) {
  const detail = { sourceId: sourceId(feature), roofColor: schoolPalette.roofs[feature.id % schoolPalette.roofs.length], roofEdgeSegments: 0, windows: [], vents: [], doors: [], canopies: [] };
  schoolDetailFor(area).buildings.push(detail);
  for (const [a, b] of edges(ring)) {
    const dx = b[0] - a[0], dz = b[1] - a[1], length = Math.hypot(dx, dz), angle = -Math.atan2(dz, dx);
    if (length > 0.4) { box((a[0] + b[0]) / 2, height + 0.48, (a[1] + b[1]) / 2, length, 0.22, 0.24, schoolPalette.trim, area.name, angle); detail.roofEdgeSegments++; }
    if (length < 5) continue;
    box((a[0] + b[0]) / 2, 0.95, (a[1] + b[1]) / 2, length, 0.25, 0.16, schoolPalette.accent, area.name, angle);
    const count = Math.floor(length / 5.5), windowHeight = Math.min(1.65, height * 0.25), y = 0.35 + height * 0.53;
    for (let i = 0; i < count; i++) {
      const t = (i + 0.5) / count, position = [a[0] + dx * t, y, a[1] + dz * t], width = Math.min(2.4, length / count * 0.48);
      box(...position, width + 0.22, windowHeight + 0.22, 0.19, schoolPalette.trim, area.name, angle);
      box(...position, width, windowHeight, 0.23, schoolPalette.window, area.name, angle);
      detail.windows.push({ position: rounded(position), width, height: windowHeight, angle });
    }
  }
  const xs = ring.map(([x]) => x), zs = ring.map(([, z]) => z);
  const maxVents = Math.min(4, Math.max(1, Math.floor((Math.max(...xs) - Math.min(...xs)) * (Math.max(...zs) - Math.min(...zs)) / 550)));
  for (let x = Math.min(...xs) + 2; x < Math.max(...xs) && detail.vents.length < maxVents; x += 3) {
    for (let z = Math.min(...zs) + 2; z < Math.max(...zs) && detail.vents.length < maxVents; z += 3) {
      const footprint = rectangle(x, z, 1.4, 1.8);
      if (!ringContained(footprint, ring, 0.5) || detail.vents.some((vent) => Math.hypot(x - vent.center[0], z - vent.center[1]) < 11)) continue;
      box(x, height + 0.7, z, 1.4, 0.6, 1.8, schoolPalette.vent, area.name);
      box(x, height + 1.03, z, 1.6, 0.1, 2, schoolPalette.trim, area.name);
      detail.vents.push({ center: rounded([x, z]), footprint: rectangle(x, z, 1.6, 2).map(rounded), baseY: height + 0.4, topY: height + 1.08 });
      if (!ringContained(rectangle(x, z, 1.6, 2), ring, 0.3)) throw new Error(`Vent cap leaves ${detail.sourceId}`);
    }
  }
}

// Join multipolygon fragments before triangulation so reserves preserve holes.
const relationMemberIds = new Set(); const polygons = [];
function stitch(members) {
  const pending = members.map((m) => wayById.get(Number(m.ref))?.geometry.map(point)).filter(Boolean);
  const rings = [];
  while (pending.length) {
    const ring = pending.shift(); let progress = true;
    while (progress && Math.hypot(ring[0][0] - ring.at(-1)[0], ring[0][1] - ring.at(-1)[1]) > 0.01) {
      progress = false;
      for (let i = 0; i < pending.length; i++) {
        const segment = pending[i], end = ring.at(-1);
        if (Math.hypot(end[0] - segment[0][0], end[1] - segment[0][1]) < 0.01) { ring.push(...segment.slice(1)); pending.splice(i, 1); progress = true; break; }
        if (Math.hypot(end[0] - segment.at(-1)[0], end[1] - segment.at(-1)[1]) < 0.01) { ring.push(...segment.toReversed().slice(1)); pending.splice(i, 1); progress = true; break; }
      }
    }
    if (Math.hypot(ring[0][0] - ring.at(-1)[0], ring[0][1] - ring.at(-1)[1]) < 0.01) rings.push(clipRing(ring));
  }
  return rings.filter((ring) => ring.length >= 3);
}
for (const f of source.elements.filter((f) => f.type === "relation")) {
  if (!f.tags.landuse && !f.tags.leisure && !f.tags.natural) continue;
  const outer = stitch(f.members.filter((m) => m.role !== "inner"));
  const inner = stitch(f.members.filter((m) => m.role === "inner"));
  for (const ring of outer) polygons.push({ feature: f, ring, holes: inner.filter((h) => inside(h[0], ring)) });
  if (outer.length) f.members.forEach((m) => relationMemberIds.add(Number(m.ref)));
}
for (const f of allWays) {
  if (relationMemberIds.has(f.id) || f.tags.building || !["landuse", "leisure", "natural", "amenity"].some((key) => f.tags[key])) continue;
  const raw = f.geometry.map(point);
  if (Math.hypot(raw[0][0] - raw.at(-1)[0], raw[0][1] - raw.at(-1)[1]) > 0.1) continue;
  const ring = clipRing(raw); if (ring.length >= 3) polygons.push({ feature: f, ring, holes: [] });
}
const greenAreas = []; const treeExclusions = [];
for (const [polygonIndex, p] of polygons.entries()) {
  const t = p.feature.tags;
  let color; let y = 0.05;
  if (["grass", "meadow", "forest", "recreation_ground"].includes(t.landuse) || ["park", "garden", "nature_reserve"].includes(t.leisure) || ["scrub", "wood"].includes(t.natural)) {
    color = t.natural === "scrub" || t.leisure === "nature_reserve" ? palette.scrub : t.landuse === "meadow" ? palette.meadow : palette.park;
    greenAreas.push(p);
  }
  if (t.amenity === "school" || t.landuse === "retail") { color = palette.campus; y = 0.12; }
  if (t.amenity === "parking") { color = palette.parking; y = 0.18; treeExclusions.push(p); }
  if (["pitch", "track", "playground", "swimming_pool"].includes(t.leisure)) {
    color = t.leisure === "track" ? palette.track : t.leisure === "swimming_pool" ? palette.water : palette.pitch; y = 0.24; treeExclusions.push(p);
  }
  if (color) flat(p.ring, color, y + polygonIndex * 0.0003, "terrain", p.holes);
}

// The source snapshot omits Mesa Verde's western athletics field. Fit the
// reference's north-south oval inside the mapped school parcel, west of its
// buildings. This is an authored surface, not a new surveyed OSM feature.
const mesaVerdeRing = cleanRing(mesaVerde.geometry.map(point));
const mesaVerdeField = [[238, -222], [425, -222], [425, -15], [238, -15]];
const mesaVerdeTrack = { center: [307, -128], radius: 32, straightHalfLength: 49, width: 4 };
function stadiumRing(radius) {
  const [cx, cz] = mesaVerdeTrack.center;
  const half = mesaVerdeTrack.straightHalfLength;
  const ring = [];
  for (let i = 0; i <= 24; i++) {
    const angle = Math.PI + i * Math.PI / 24;
    ring.push([cx + Math.cos(angle) * radius, cz - half + Math.sin(angle) * radius]);
  }
  for (let i = 0; i <= 24; i++) {
    const angle = i * Math.PI / 24;
    ring.push([cx + Math.cos(angle) * radius, cz + half + Math.sin(angle) * radius]);
  }
  return ring;
}
const mesaVerdeTrackRing = stadiumRing(mesaVerdeTrack.radius);
if (![...mesaVerdeField, ...mesaVerdeTrackRing].every((p) => inside(p, mesaVerdeRing))) {
  throw new Error("Authored Mesa Verde field must remain inside its school parcel");
}
const mesaVerdeInfield = stadiumRing(mesaVerdeTrack.radius - mesaVerdeTrack.width);
// Adjacent surfaces avoid stacked additive glow across the field and infield.
flat(mesaVerdeField, palette.park, 0.4, "Mesa Verde Middle School", [mesaVerdeTrackRing]);
flat(mesaVerdeTrackRing, palette.walk, 0.43, "Mesa Verde Middle School", [mesaVerdeInfield]);
flat(mesaVerdeInfield, palette.pitch, 0.46, "Mesa Verde Middle School");
treeExclusions.push({ feature: mesaVerde, ring: mesaVerdeField, holes: [] });

// Buildings: real OSM footprints, upstream Map3D extrusion, explicit inferred
// heights only where OSM lacks them. Details are baked into the same batch/root.
const buildingRecords = []; let inferredHeights = 0;
for (const f of allWays.filter((f) => f.tags.building && f.tags.building !== "no")) {
  const ring = cleanRing(f.geometry.map(point)); const center = centroid(ring);
  if (ring.length < 3 || !inBounds(center)) continue;
  const landmark = landmarkAreas.find((area) => inside(center, area.ring));
  const tags = { ...f.tags };
  let inferred = false;
  if (!Number.parseFloat(tags.height) && !Number.parseFloat(tags["building:levels"])) {
    tags.height = String(landmark ? (landmark.id === "westview-high-school" ? 8.5 : landmark.id === "torrey-highlands-plaza" ? 7 : 6.5) : ["office", "commercial"].includes(tags.building) ? 12 : 6.5);
    inferred = true; inferredHeights++;
  }
  const [data] = areaData(THREE, [{ geometry: f.geometry.map((p) => ({ lat: p.lat, lng: p.lon })), tags }], project);
  const batch = landmark?.name ?? "Neighborhood buildings"; const height = data.extrudeSettings.depth;
  const geometry = new THREE.ExtrudeGeometry(data.shape, data.extrudeSettings); geometry.rotateX(-Math.PI / 2); geometry.translate(0, 0.35, 0);
  const school = schoolAreas.find((area) => area.id === landmark?.id);
  add(geometry, school ? schoolPalette.wall : landmark?.id === "westview-high-school" ? palette.campusWall : palette.wall[f.id % palette.wall.length], batch);
  flat(ring, school ? schoolPalette.roofs[f.id % schoolPalette.roofs.length] : landmark ? palette.landmarkRoof : palette.roof[f.id % palette.roof.length], height + 0.37, batch);
  if (school) schoolFacades(school, f, ring, height);
  if (landmark) {
    landmark.sourceIds.push(sourceId(f));
    if (!school) for (let i = 0; i < ring.length; i++) {
      const a = ring[i], b = ring[(i + 1) % ring.length]; const dx = b[0] - a[0], dz = b[1] - a[1]; const length = Math.hypot(dx, dz);
      if (length < 7) continue;
      const count = Math.floor(length / 6); const angle = -Math.atan2(dz, dx);
      for (let k = 0; k < count; k++) {
        const t = (k + 0.5) / count;
        box(a[0] + dx * t, 3.9, a[1] + dz * t, Math.min(2.3, length / count * 0.5), 2, 0.22, palette.window, batch, angle);
      }
    }
  }
  buildingRecords.push({ sourceId: sourceId(f), ring: ring.map(rounded), height, inferredHeight: inferred, landmark: landmark?.id ?? null });
}
for (const area of landmarkAreas) if (!area.sourceIds.length) throw new Error(`No mapped buildings for ${area.name}`);

const roadRecords = [];
const walking = new Set(["footway", "path", "pedestrian", "cycleway", "steps", "track"]);
const bridgeNodes = allWays.filter((f) => f.tags.bridge === "yes" && f.tags.highway).flatMap((f) => [point(f.geometry[0]), point(f.geometry.at(-1))]);
function roadWidth(tags) {
  if (Number.parseFloat(tags.width)) return Math.min(28, Number.parseFloat(tags.width));
  if (walking.has(tags.highway)) return tags.highway === "cycleway" ? 3.5 : 2.2;
  const defaults = { motorway: 12, motorway_link: 6, primary: 10, secondary: 9, tertiary: 8, residential: 7, service: 4.5 };
  return tags.lanes ? Math.max(4.5, Math.min(25, Number(tags.lanes) * 3.35)) : defaults[tags.highway] ?? 6;
}
function roadY(p, tags) {
  if (tags.bridge === "yes") return 5.8 + (Number(tags.layer) || 1) * 0.1;
  let approach = 0;
  if (!walking.has(tags.highway)) for (const b of tags.bridgeApproaches ?? []) approach = Math.max(approach, 5.4 * Math.max(0, 1 - Math.hypot(p[0] - b[0], p[1] - b[1]) / 70));
  return 0.5 + approach;
}
function clipSegment(a, b) {
  let low = 0, high = 1;
  const dx = b[0] - a[0], dz = b[1] - a[1];
  for (const [p, q] of [[-dx, a[0] - limits.minX], [dx, limits.maxX - a[0]], [-dz, a[1] - limits.minZ], [dz, limits.maxZ - a[1]]]) {
    if (p === 0) { if (q < 0) return null; continue; }
    const t = q / p;
    if (p < 0) low = Math.max(low, t); else high = Math.min(high, t);
    if (low > high) return null;
  }
  return [[a[0] + dx * low, a[1] + dz * low], [a[0] + dx * high, a[1] + dz * high]];
}
function ribbon(points, width, color, tags, lift = 0, batch = "Streets and paths") {
  const verts = [];
  for (let i = 0; i + 1 < points.length; i++) {
    const clipped = clipSegment(points[i], points[i + 1]); if (!clipped) continue;
    const [a, b] = clipped;
    const dx = b[0] - a[0], dz = b[1] - a[1], length = Math.hypot(dx, dz); if (length < 0.01) continue;
    const ox = -dz / length * width / 2, oz = dx / length * width / 2;
    const ay = roadY(a, tags) + lift, by = roadY(b, tags) + lift;
    const p = [[a[0] + ox, ay, a[1] + oz], [a[0] - ox, ay, a[1] - oz], [b[0] + ox, by, b[1] + oz], [b[0] - ox, by, b[1] - oz]];
    for (const n of [0, 2, 1, 1, 2, 3]) verts.push(...p[n]);
  }
  if (!verts.length) return;
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3)); add(geometry, color, batch);
}
for (const f of allWays.filter((f) => f.tags.highway && !["proposed", "construction"].includes(f.tags.highway))) {
  const points = f.geometry.map(point); if (!points.some((p) => inBounds(p))) continue;
  const tags = { ...f.tags, bridgeApproaches: bridgeNodes.filter((b) => points.some((p) => Math.hypot(p[0] - b[0], p[1] - b[1]) < 0.1)) };
  const width = roadWidth(f.tags); const foot = walking.has(f.tags.highway); const freeway = f.tags.highway.startsWith("motorway");
  if (!foot) ribbon(points, width + (freeway ? 1.5 : 2), palette.walk, tags, -0.035);
  ribbon(points, width, foot ? palette.walk : freeway ? palette.freeway : palette.road, tags, foot ? 0.03 : 0);
  roadRecords.push({ sourceId: sourceId(f), name: f.tags.name ?? null, kind: f.tags.highway, width, bridge: f.tags.bridge === "yes", layer: Number(f.tags.layer) || 0, points: points.map(rounded) });
  if (freeway || f.tags.highway === "primary") {
    for (let i = 0; i + 1 < points.length; i++) {
      const a = points[i], b = points[i + 1], distance = Math.hypot(b[0] - a[0], b[1] - a[1]);
      for (let d = 3; d + 4 < distance; d += 12) {
        const first = [a[0] + (b[0] - a[0]) * d / distance, a[1] + (b[1] - a[1]) * d / distance];
        const last = [a[0] + (b[0] - a[0]) * (d + 4) / distance, a[1] + (b[1] - a[1]) * (d + 4) / distance];
        ribbon([first, last], 0.2, "#cfc9af", tags, 0.05);
      }
    }
  }
}


// Fixed modest campus gathering and play additions use verified open space.
// They are baked into the same school roots as the buildings and athletics.
function campusGroundClear(ring, area, ignoreBuilding = null, clearance = 0.6) {
  if (!ringContained(ring, area.ring, 0.4)) return false;
  if (buildingRecords.some((building) => building.sourceId !== ignoreBuilding && ringsOverlap(ring, building.ring, clearance))) return false;
  return !roadRecords.some((road) => road.points.slice(1).some((b, i) => {
    const a = road.points[i];
    return inside(a, ring) || inside(b, ring) || edges(ring).some(([c, d]) => segmentsIntersect(a, b, c, d)
      || Math.min(segmentDistance(a, c, d), segmentDistance(b, c, d), segmentDistance(c, a, b), segmentDistance(d, a, b)) < road.width / 2 + 1);
  }));
}
function addSchoolSurface(area, id, kind, ring, color, y = 0.55) {
  if (!campusGroundClear(ring, area)) throw new Error(`Unsafe school surface ${id}`);
  flat(ring, color, y, area.name);
  schoolDetailFor(area).surfaces.push({ id, kind, footprint: ring.map(rounded), color, y });
  treeExclusions.push({ feature: area.feature, ring, holes: [] });
}
for (const area of schoolAreas) {
  const mesa = area.feature.id === 61861106;
  const court = mesa ? rectangle(395.5, -185.5, 51, 41) : rectangle(905, -410.5, 38, 43);
  addSchoolSurface(area, `${area.id}-court`, "court", court, schoolPalette.court);
  // Inset perimeter and a single center stripe read at the neighborhood scale.
  const [minX, minZ] = court[0], [maxX, maxZ] = court[2];
  const inset = [[minX + 3, minZ + 3], [maxX - 3, minZ + 3], [maxX - 3, maxZ - 3], [minX + 3, maxZ - 3]];
  for (const [a, b] of edges(inset)) {
    const dx = b[0] - a[0], dz = b[1] - a[1], length = Math.hypot(dx, dz);
    flat(rectangle((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, length, 0.24, -Math.atan2(dz, dx)), schoolPalette.line, 0.58, area.name);
  }
  flat(rectangle((minX + maxX) / 2, (minZ + maxZ) / 2, maxX - minX - 6, 0.24), schoolPalette.line, 0.58, area.name);
  if (!mesa) addSchoolSurface(area, `${area.id}-play`, "play", rectangle(904, -337, 32, 32), schoolPalette.play);
  const shade = mesa ? rectangle(401, -140, 22, 12) : rectangle(897.5, -298, 19, 12);
  addSchoolSurface(area, `${area.id}-gathering`, "gathering", shade, palette.walk);
  const center = centroid(shade), width = shade[1][0] - shade[0][0], depth = shade[2][1] - shade[1][1];
  const structureRing = rectangle(...center, width - 2, depth - 2);
  box(center[0], 3.65, center[1], width - 2, 0.3, depth - 2, schoolPalette.canopy, area.name);
  for (const [x, z] of rectangle(...center, width - 3, depth - 3)) box(x, 1.95, z, 0.35, 3.4, 0.35, schoolPalette.trim, area.name);
  for (const offset of [-depth / 4, depth / 4]) {
    box(center[0], 0.85, center[1] + offset, width * 0.45, 0.3, 1.1, schoolPalette.accent, area.name);
    for (const side of [-1, 1]) box(center[0] + side * width * 0.17, 0.625, center[1] + offset, 0.6, 0.15, 0.8, schoolPalette.trim, area.name);
  }
  schoolDetailFor(area).structures.push({ id: `${area.id}-shade`, kind: "gathering-shade", footprint: structureRing.map(rounded), baseY: 0.25, topY: 3.8 });
  const paths = mesa ? [rectangle(411.5, -100, 5, 120), rectangle(395.5, -157, 37, 4)]
    : [rectangle(880, -360, 4, 140), rectangle(900, -379, 40, 4), rectangle(900, -359, 40, 4), rectangle(889, -312, 18, 4)];
  for (const [index, path] of paths.entries()) addSchoolSurface(area, `${area.id}-path-${index + 1}`, "path", path, palette.walk);
  // Entrance canopies face a verified open side of each actual footprint.
  for (const detail of schoolDetailFor(area).buildings) {
    const building = buildingRecords.find((record) => record.sourceId === detail.sourceId);
    for (const [a, b] of edges(building.ring).sort(([a, b], [c, d]) => Math.hypot(d[0] - c[0], d[1] - c[1]) - Math.hypot(b[0] - a[0], b[1] - a[1]))) {
      const dx = b[0] - a[0], dz = b[1] - a[1], length = Math.hypot(dx, dz);
      if (length < 4.8) continue;
      const angle = -Math.atan2(dz, dx), middle = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      let normal = [-dz / length, dx / length];
      if (inside([middle[0] + normal[0], middle[1] + normal[1]], building.ring)) normal = normal.map((n) => -n);
      const center = [middle[0] + normal[0] * 1.9, middle[1] + normal[1] * 1.9];
      const footprint = rectangle(...center, 4.2, 3.2, angle);
      if (!campusGroundClear(footprint, area, building.sourceId) || ringsOverlap(footprint, building.ring, 0.15) || schoolDetailFor(area).surfaces.some((surface) => ringsOverlap(footprint, surface.footprint, 0.4))) continue;
      const doorPosition = [middle[0] + normal[0] * 0.13, 1.55, middle[1] + normal[1] * 0.13];
      box(...doorPosition, 1.65, 2.4, 0.3, schoolPalette.window, area.name, angle);
      box(center[0], 3.15, center[1], 4.2, 0.24, 3.2, schoolPalette.canopy, area.name, angle);
      for (const [x, z] of rectangle(...center, 3.7, 2.7, angle)) box(x, 1.575, z, 0.18, 2.91, 0.18, schoolPalette.trim, area.name);
      detail.doors.push({ position: rounded(doorPosition), width: 1.65, height: 2.4, angle });
      detail.canopies.push({ footprint: footprint.map(rounded), baseY: 0.12, topY: 3.27, angle });
      treeExclusions.push({ feature: area.feature, ring: footprint, holes: [] });
      break;
    }
  }
}

// Deterministic stylized landscape. Every canopy clears buildings, roadbeds,
// parking lots, sport surfaces, and other canopies, including source trees.
let seed = 56013500;
function random() { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; }
const trees = [];
const buildingGrid = new Map(), roadGrid = new Map(), treeGrid = new Map(); const cellSize = 40;
function cellsFor(minX, maxX, minZ, maxZ) { const keys = []; for (let x = Math.floor(minX / cellSize); x <= Math.floor(maxX / cellSize); x++) for (let z = Math.floor(minZ / cellSize); z <= Math.floor(maxZ / cellSize); z++) keys.push(`${x},${z}`); return keys; }
function indexRecord(grid, record, points, margin) {
  const xs = points.map((p) => p[0]), zs = points.map((p) => p[1]);
  for (const key of cellsFor(Math.min(...xs) - margin, Math.max(...xs) + margin, Math.min(...zs) - margin, Math.max(...zs) + margin)) { if (!grid.has(key)) grid.set(key, []); grid.get(key).push(record); }
}
for (const b of buildingRecords) indexRecord(buildingGrid, b, b.ring, 8);
for (const r of roadRecords) for (let i = 1; i < r.points.length; i++) indexRecord(roadGrid, { a: r.points[i - 1], b: r.points[i], width: r.width }, [r.points[i - 1], r.points[i]], r.width / 2 + 8);
function validTree(p, radius) {
  if (!inBounds(p, radius + 2)) return false;
  const key = `${Math.floor(p[0] / cellSize)},${Math.floor(p[1] / cellSize)}`;
  if ((buildingGrid.get(key) ?? []).some((b) => nearRing(p, b.ring, radius + 1))) return false;
  if ((roadGrid.get(key) ?? []).some((r) => segmentDistance(p, r.a, r.b) < r.width / 2 + radius + 1)) return false;
  if (treeExclusions.some((e) => nearRing(p, e.ring, radius + 1))) return false;
  if ((treeGrid.get(key) ?? []).some((t) => Math.hypot(p[0] - t.x, p[1] - t.z) < radius + t.radius + 1)) return false;
  return true;
}
function addTree(p, sourceId = null) {
  const radius = 2.8 + random() * 2.5; if (!validTree(p, radius)) return false;
  const height = 7 + random() * 5;
  const tree = { x: p[0], z: p[1], radius, height, sourceId }; trees.push(tree); indexRecord(treeGrid, tree, [p], radius + 7);
  const trunk = new THREE.CylinderGeometry(0.35, 0.48, height * 0.65, 5); trunk.translate(p[0], height * 0.325, p[1]); add(trunk, palette.trunk, "Trees");
  const crown = new THREE.IcosahedronGeometry(1, 0); crown.scale(radius, height * 0.4, radius); crown.rotateY(random() * Math.PI); crown.translate(p[0], height * 0.7, p[1]); add(crown, palette.leaf[Math.floor(random() * palette.leaf.length)], "Trees");
  return true;
}
for (const f of source.elements.filter((f) => f.type === "node" && f.tags.natural === "tree")) addTree(point(f), sourceId(f));
for (const area of greenAreas) {
  const xs = area.ring.map((p) => p[0]), zs = area.ring.map((p) => p[1]);
  const sparse = area.feature.tags.natural === "scrub" || area.feature.tags.leisure === "nature_reserve";
  const spacing = sparse ? 45 : 23;
  for (let x = Math.min(...xs) + spacing / 2; x < Math.max(...xs); x += spacing) for (let z = Math.min(...zs) + spacing / 2; z < Math.max(...zs); z += spacing) {
    const p = [x + (random() - 0.5) * spacing * 0.75, z + (random() - 0.5) * spacing * 0.75];
    if (inside(p, area.ring) && !area.holes.some((h) => inside(p, h)) && random() > 0.25) addTree(p);
  }
}
// Restrained street-side planting follows actual residential/arterial geometry.
for (const road of roadRecords.filter((r) => ["residential", "primary", "secondary", "tertiary"].includes(r.kind))) {
  for (let i = 1; i < road.points.length; i++) {
    const a = road.points[i - 1], b = road.points[i], dx = b[0] - a[0], dz = b[1] - a[1], distance = Math.hypot(dx, dz);
    for (let d = 13; d < distance; d += 38) for (const side of [-1, 1]) {
      const offset = road.width / 2 + 9; addTree([a[0] + dx * d / distance - dz / distance * offset * side, a[1] + dz * d / distance + dx / distance * offset * side]);
    }
  }
}

for (const detail of schoolDetails) {
  const expected = detail.campusSourceId === "way/61861106" ? 7 : 12;
  if (detail.buildings.length !== expected) throw new Error(`Unexpected mapped school building count for ${detail.name}`);
  detail.counts = { buildings: detail.buildings.length, roofEdgeSegments: detail.buildings.reduce((n, b) => n + b.roofEdgeSegments, 0), ...Object.fromEntries(["windows", "vents", "doors", "canopies"].map((kind) => [kind, detail.buildings.reduce((n, b) => n + b[kind].length, 0)])), surfaces: detail.surfaces.length, shadeStructures: detail.structures.length };
}

const landmarkResults = [];
for (const [name, geometries] of batches) {
  const geometry = mergeGeometries(geometries); if (!geometry) throw new Error(`Failed merging ${name}`);
  const position = geometry.getAttribute("position");
  if (!Array.from(position.array).every(Number.isFinite)) throw new Error(`Non-finite geometry in ${name}`);
  const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.96, side: THREE.DoubleSide }));
  mesh.name = name; mesh.castShadow = name !== "terrain"; mesh.receiveShadow = true;
  const area = landmarkAreas.find((a) => a.name === name);
  if (area) {
    // A single geometry, single material and centered transform is the complete
    // landmark: GLTFLoader must return Mesh rather than a multi-primitive Group.
    geometry.computeBoundingBox(); const bounds = geometry.boundingBox.clone(); const center = bounds.getCenter(new THREE.Vector3());
    geometry.translate(-center.x, 0, -center.z); mesh.position.set(center.x, 0, center.z);
    mesh.userData.cameraViewId = area.id;
    landmarkResults.push({ cameraViewId: area.id, rootName: name, address: area.address, areaSourceId: sourceId(area.feature), buildingSourceIds: area.sourceIds, center: rounded([center.x, 0, center.z]), bounds: { min: rounded(bounds.min.toArray()), max: rounded(bounds.max.toArray()) }, camera: area.id === "westview-high-school" ? { azimuth: 0, height: 500, radius: 650, zoom: 1.4 } : { azimuth: 0, height: 350, radius: 460, zoom: 1.6 } });
  }
  scene.add(mesh);
}

class NodeFileReader {
  result = null; onloadend = null; onerror = null;
  async readAsArrayBuffer(blob) { try { this.result = await blob.arrayBuffer(); this.onloadend?.(); } catch (error) { this.onerror?.(error); } }
  async readAsDataURL(blob) { try { this.result = `data:${blob.type};base64,${Buffer.from(await blob.arrayBuffer()).toString("base64")}`; this.onloadend?.(); } catch (error) { this.onerror?.(error); } }
}
globalThis.FileReader ??= NodeFileReader;
await fs.writeFile(MODEL, Buffer.from(await new GLTFExporter().parseAsync(scene, { binary: true, onlyVisible: true })));
await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ "meshopt.encoder": MeshoptEncoder });
const document = await io.read(MODEL);
// The neighborhood spans about 3.06 km, so even 16-bit position quantization merges the
// 2–5 cm road, shoulder, roof and surface layers. Keep Float32 positions exactly;
// lossless Meshopt still compresses the resulting buffers effectively.
await document.transform(dedup(), weld(), prune(), reorder({ encoder: MeshoptEncoder, target: "size" }), quantize({ pattern: /^(NORMAL|COLOR_0)$/, quantizeNormal: 10, quantizeColor: 8 }));
document.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.QUANTIZE });
await io.write(MODEL, document);
const glb = await fs.readFile(MODEL);
const manifest = {
  version: 1, name: "Torrey Highlands · San Diego", modelUrl: "/models/san-diego/torrey-highlands.glb", contentHash: crypto.createHash("sha256").update(glb).digest("hex"), byteLength: glb.byteLength,
  attribution: "© OpenStreetMap contributors · Map3D (MIT)", source: { ...source, elements: undefined, snapshot: "/data/san-diego/source.osm.json" },
  map3d: { repository: "https://github.com/cartesiancs/map3d", commit: COMMIT, license: "MIT", sourceFile: "src/three/Space.tsx", implementation: "Executes the pinned upstream areaData extrusion function; replaces its 51000 arbitrary scale with a local metric projection and supplies explicit inferred heights where OSM has none." },
  projection: { type: "local-equirectangular", originLongitudeLatitude: ORIGIN, units: "meters", axes: "east +X, up +Y, north -Z", metersPerLatitudeDegree: M_PER_LAT, metersPerLongitudeDegree: M_PER_LON },
  bounds: BOUNDS, localBounds: limits,
  overview: { target: [0, 0, -240], height: 1200, radius: 1350, zoom: 0.5 }, landmarks: landmarkResults,
  authoredSurfaces: { mesaVerdeAthletics: { campusSourceId: sourceId(mesaVerde), field: mesaVerdeField, track: mesaVerdeTrack, reference: "User-supplied Mesa Verde map screenshot; approximate placement and dimensions." } },
  schoolDetails: { provenance: "Deterministic artistic architectural and campus details; mapped OSM footprints and heights retained. Court, play, shade, and paths are approximate authored placements, not surveyed architecture.", palette: schoolPalette, campuses: schoolDetails },
  counts: { buildings: buildingRecords.length, buildingsWithInferredHeight: inferredHeights, roadsAndPaths: roadRecords.length, bridges: roadRecords.filter((r) => r.bridge).length, landcoverPolygons: polygons.length, greenAreas: greenAreas.length, trees: trees.length, sourcedTrees: trees.filter((t) => t.sourceId).length, selectableLandmarks: landmarkResults.length, meshes: scene.children.length },
  assumptions: ["Flat stylized terrain; no surveyed elevation model.", "Building footprints, roads, campus, plaza, parks, and sport surfaces use OpenStreetMap geometry. Missing building heights: homes 6.5 m, offices/commercial 12 m, Westview 8.5 m, plaza 7 m. Supplied OSM levels retain Map3D's 2.2 m/level convention.", "Window panels, flat roof colors, and supplemental trees are deterministic artistic details, not surveyed architecture or vegetation.", "Mesa Verde athletics field and north-south oval track are authored from the user reference within the mapped school parcel; placement and dimensions are approximate.", "Road widths are inferred from tagged lane counts or highway class where explicit widths are absent. Mapped bridges are raised to 5.9 m with 70 m approach ramps.", "All landmark buildings, roofs, and facade panels are merged into one selectable mesh per destination. Mesa Verde also includes its authored athletics field and track in that same selectable mesh."],
  compression: { extension: "EXT_meshopt_compression", positions: "lossless Float32 (preserves centimeter layer gaps)", normals: "10-bit", colors: "8-bit" },
  palette,
  treeValidation: { seed: 56013500, excluded: ["building footprint plus canopy radius + 1 m", "road/path half-width plus canopy radius + 1 m", "parking, sports, authored school surfaces and entrance canopies plus canopy radius + 1 m", "other canopies plus 1 m"], conflicts: 0 },
};
await fs.writeFile(`${DATA}/manifest.json`, JSON.stringify(manifest, null, 2) + "\n");
await fs.writeFile(`${DATA}/layout.json`, JSON.stringify({ schoolDetails, buildings: buildingRecords, roads: roadRecords, greenAreas: greenAreas.map((p) => ({ sourceId: sourceId(p.feature), ring: p.ring.map(rounded), holes: p.holes.map((h) => h.map(rounded)) })), treeExclusions: treeExclusions.map((p) => ({ sourceId: sourceId(p.feature), ring: p.ring.map(rounded) })), trees: trees.map((t) => ({ ...t, x: Math.round(t.x * 1000) / 1000, z: Math.round(t.z * 1000) / 1000, radius: Math.round(t.radius * 1000) / 1000 })) }));
await fs.copyFile(`${UPSTREAM}/LICENSE`, `${DATA}/MAP3D-LICENSE.txt`);
console.log(JSON.stringify({ counts: manifest.counts, landmarks: landmarkResults, modelKiB: Math.round(glb.byteLength / 1024), contentHash: manifest.contentHash }, null, 2));
