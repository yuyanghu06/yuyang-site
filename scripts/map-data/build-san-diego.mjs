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
const BOUNDS = { west: -117.163, south: 32.951, east: -117.138, north: 32.971 };
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
let source;
try { if (process.argv.includes("--refresh")) throw new Error("refresh"); source = JSON.parse(await fs.readFile(sourcePath, "utf8")); }
catch {
  const bbox = `${BOUNDS.west},${BOUNDS.south},${BOUNDS.east},${BOUNDS.north}`;
  let xml;
  if (!process.argv.includes("--refresh")) {
    try { xml = await fs.readFile(`${UPSTREAM}/san-diego-source.osm`, "utf8"); } catch { /* Fresh checkout downloads below. */ }
  }
  if (!xml) {
    const response = await fetch(`https://api.openstreetmap.org/api/0.6/map?bbox=${bbox}`, { signal: AbortSignal.timeout(60000), headers: { "User-Agent": "YuyangSite San Diego map study" } });
    if (!response.ok) throw new Error(`OSM export failed: ${response.status}`);
    xml = await response.text();
  }
  source = { license: "ODbL-1.0", attribution: "© OpenStreetMap contributors", sourceUrl: `https://api.openstreetmap.org/api/0.6/map?bbox=${bbox}`, retrievedAt: new Date().toISOString(), bounds: BOUNDS, elements: parseOsm(xml) };
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
if (!campus || !plaza) throw new Error("Required OSM landmark areas are missing");
const landmarkAreas = [
  { id: "westview-high-school", name: "Westview High School", feature: campus, ring: cleanRing(campus.geometry.map(point)), address: "13500 Camino Del Sur, San Diego, CA 92129", sourceIds: [] },
  { id: "torrey-highlands-plaza", name: "Torrey Highlands Plaza", feature: plaza, ring: cleanRing(plaza.geometry.map(point)), address: "7845 Highlands Village Place, San Diego, CA 92129 (Chef Zhu, C101)", sourceIds: [] },
];

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
    tags.height = String(landmark ? (landmark.id === "westview-high-school" ? 8.5 : 7) : ["office", "commercial"].includes(tags.building) ? 12 : 6.5);
    inferred = true; inferredHeights++;
  }
  const [data] = areaData(THREE, [{ geometry: f.geometry.map((p) => ({ lat: p.lat, lng: p.lon })), tags }], project);
  const batch = landmark?.name ?? "Neighborhood buildings"; const height = data.extrudeSettings.depth;
  const geometry = new THREE.ExtrudeGeometry(data.shape, data.extrudeSettings); geometry.rotateX(-Math.PI / 2); geometry.translate(0, 0.35, 0);
  add(geometry, landmark?.id === "westview-high-school" ? palette.campusWall : palette.wall[f.id % palette.wall.length], batch);
  flat(ring, landmark ? palette.landmarkRoof : palette.roof[f.id % palette.roof.length], height + 0.37, batch);
  if (landmark) {
    landmark.sourceIds.push(sourceId(f));
    for (let i = 0; i < ring.length; i++) {
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
// A neighborhood spans 2.3 km, so even 16-bit position quantization merges the
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
  overview: { target: [0, 0, 0], height: 1200, radius: 1350, zoom: 0.65 }, landmarks: landmarkResults,
  counts: { buildings: buildingRecords.length, buildingsWithInferredHeight: inferredHeights, roadsAndPaths: roadRecords.length, bridges: roadRecords.filter((r) => r.bridge).length, landcoverPolygons: polygons.length, greenAreas: greenAreas.length, trees: trees.length, sourcedTrees: trees.filter((t) => t.sourceId).length, selectableLandmarks: landmarkResults.length, meshes: scene.children.length },
  assumptions: ["Flat stylized terrain; no surveyed elevation model.", "Building footprints, roads, campus, plaza, parks, and sport surfaces use OpenStreetMap geometry. Missing building heights: homes 6.5 m, offices/commercial 12 m, Westview 8.5 m, plaza 7 m. Supplied OSM levels retain Map3D's 2.2 m/level convention.", "Window panels, flat roof colors, and supplemental trees are deterministic artistic details, not surveyed architecture or vegetation.", "Road widths are inferred from tagged lane counts or highway class where explicit widths are absent. Mapped bridges are raised to 5.9 m with 70 m approach ramps.", "All landmark buildings, roofs, and facade panels are merged into one selectable mesh per destination."],
  compression: { extension: "EXT_meshopt_compression", positions: "lossless Float32 (preserves centimeter layer gaps)", normals: "10-bit", colors: "8-bit" },
  palette,
  treeValidation: { seed: 56013500, excluded: ["building footprint plus canopy radius + 1 m", "road/path half-width plus canopy radius + 1 m", "parking and sports polygons plus canopy radius + 1 m", "other canopies plus 1 m"], conflicts: 0 },
};
await fs.writeFile(`${DATA}/manifest.json`, JSON.stringify(manifest, null, 2) + "\n");
await fs.writeFile(`${DATA}/layout.json`, JSON.stringify({ buildings: buildingRecords, roads: roadRecords, greenAreas: greenAreas.map((p) => ({ sourceId: sourceId(p.feature), ring: p.ring.map(rounded), holes: p.holes.map((h) => h.map(rounded)) })), treeExclusions: treeExclusions.map((p) => ({ sourceId: sourceId(p.feature), ring: p.ring.map(rounded) })), trees: trees.map((t) => ({ ...t, x: Math.round(t.x * 1000) / 1000, z: Math.round(t.z * 1000) / 1000, radius: Math.round(t.radius * 1000) / 1000 })) }));
await fs.copyFile(`${UPSTREAM}/LICENSE`, `${DATA}/MAP3D-LICENSE.txt`);
console.log(JSON.stringify({ counts: manifest.counts, landmarks: landmarkResults, modelKiB: Math.round(glb.byteLength / 1024), contentHash: manifest.contentHash }, null, 2));
