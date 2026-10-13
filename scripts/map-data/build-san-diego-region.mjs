/** Offline regional OSM landscape. Run with --refresh only to reacquire sources. */
import fs from "node:fs/promises";
import crypto from "node:crypto";
import * as THREE from "three";
import { GLTFExporter } from "three/addons/exporters/GLTFExporter.js";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS, EXTMeshoptCompression } from "@gltf-transform/extensions";
import { dedup, prune, quantize, reorder, weld } from "@gltf-transform/functions";
import { MeshoptEncoder } from "meshoptimizer";
import { loadRegionSource, REGION, SNAPSHOT } from "./san-diego-region-source.mjs";
import { ORIGIN, M_LAT, M_LON, OLD, point, rounded, clean, center, distance, inside, inOld, segmentDistance, simplify, clipRing, gridIndex, splitGridLine, createCoastalGeography, createGeometryKit } from "./san-diego-region-geometry.mjs";

const DATA = "public/data/san-diego";
const MODEL = "public/models/san-diego/region.glb";
const source = await loadRegionSource(process.argv.includes("--refresh"));
const oldManifest = JSON.parse(await fs.readFile(`${DATA}/manifest.json`, "utf8"));
const palette = { ...oldManifest.palette, ocean: "#8fbfc5", surf: "#e3e6cd", sand: "#ded0aa", rock: ["#b1a38a", "#c4ac8b", "#918f7a", "#d0b995"], foam: "#f1eed9" };
const limits = { minX: (REGION.west - ORIGIN[0]) * M_LON, maxX: (REGION.east - ORIGIN[0]) * M_LON, minZ: -(REGION.north - ORIGIN[1]) * M_LAT, maxZ: -(REGION.south - ORIGIN[1]) * M_LAT };
const inBounds = ([x, z], margin = 0) => x >= limits.minX + margin && x <= limits.maxX - margin && z >= limits.minZ + margin && z <= limits.maxZ - margin;
const ways = source.elements.filter((f) => f.type === "way"), byId = new Map(ways.map((f) => [f.id, f]));
const coastWays = ways.filter((f) => f.tags.natural === "coastline");
const padded = { minX: limits.minX - 5000, maxX: limits.maxX + 2500, minZ: limits.minZ - 2500, maxZ: limits.maxZ + 2500 };
const { mainland: coast, islands: coastalIslands, coastX, isLand, clipLand } = createCoastalGeography(coastWays.map((f) => f.geometry.map(point)), padded);
if (coast.length < 20) throw new Error("Regional source must contain mapped Pacific coastline");
const creekWays = ways.filter((f) => f.tags.waterway && /penasquitos|peñasquitos|carmel creek/i.test(f.tags.name ?? ""));
const creekGrid = new Map();
for (const f of creekWays) for (let i = 1; i < f.geometry.length; i++) {
  const a = point(f.geometry[i - 1]), b = point(f.geometry[i]);
  for (let x = Math.floor((Math.min(a[0], b[0]) - 500) / 500); x <= Math.floor((Math.max(a[0], b[0]) + 500) / 500); x++) for (let z = Math.floor((Math.min(a[1], b[1]) - 500) / 500); z <= Math.floor((Math.max(a[1], b[1]) + 500) / 500); z++) {
    const key = `${x},${z}`; if (!creekGrid.has(key)) creekGrid.set(key, []); creekGrid.get(key).push([a, b]);
  }
}
const smooth = (v) => { const t = Math.max(0, Math.min(1, v)); return t * t * (3 - 2 * t); };
// An intentionally enlarged coastal ridge makes the reserve read as a mountain
// at district scale. Its compact support leaves the lagoon, beach, settlements
// and all other districts at their existing elevations. This is not DEM data.
function torreyRidge(x, z) {
  const inland = x - coastX(z);
  if (z <= 3150 || z >= 5700 || inland <= 190 || inland >= 1250) return 0;
  const ends = smooth((z - 3150) / 450) * smooth((5700 - z) / 650);
  const crest = 1 - 0.065 * ((inland - 555) / 160) ** 2;
  const cross = inland < 450 ? (1 - 0.065 * (105 / 160) ** 2) * smooth((inland - 190) / 260) : inland <= 680 ? crest : (1 - 0.065 * (125 / 160) ** 2) * (1 - smooth((inland - 680) / 570));
  // Two shallow diagonal cuts distinguish the ridge's descending shoulders.
  const gullies = 1 - 0.2 * Math.exp(-(((z - 3730 - inland * 0.17) / 100) ** 2)) - 0.16 * Math.exp(-(((z - 4880 + inland * 0.12) / 115) ** 2));
  return Math.max(0, cross) * ends * gullies;
}
function authoredHeight(x, z) {
  const inland = x - coastX(z); if (inland < 15 || !isLand([x, z])) return -2;
  const hill = (hx, hz, radius, height) => height * Math.exp(-((x - hx) ** 2 + (z - hz) ** 2) / radius ** 2);
  let y = 24 + hill(-1700, -700, 2200, 90) + hill(3400, -2500, 1600, 150) + hill(-6300, 500, 2800, 70) + hill(-500, 6500, 3300, 85);
  // Coastal cliffs and canyon relief are artistic topography, not surveyed DEM.
  if (z > 2700 && z < 7800) y += 52 * Math.exp(-(((inland - 350) / 600) ** 2));
  const ridge = torreyRidge(x, z), summit = 310 + 9 * Math.cos((z - 4310) / 490);
  y += Math.max(0, summit - y) * ridge;
  let creekDistance = Infinity;
  for (const [a, b] of creekGrid.get(`${Math.floor(x / 500)},${Math.floor(z / 500)}`) ?? []) creekDistance = Math.min(creekDistance, segmentDistance([x, z], a, b));
  if (creekDistance < 500) { const bottom = Math.max(3, inland * 0.002); y = bottom + (y - bottom) * smooth(creekDistance / 460); }
  y *= smooth((inland - 15) / 110);
  // Blend continuously into the immutable flat Torrey Highlands patch.
  const oldDistance = Math.hypot(Math.max(OLD.minX - x, 0, x - OLD.maxX), Math.max(OLD.minZ - z, 0, z - OLD.maxZ));
  return y * smooth(oldDistance / 650);
}
const coordinates = (min, max, extras) => [...new Set([...Array.from({ length: Math.ceil((max - min) / 130) }, (_, i) => min + i * 130), max, ...extras])].sort((a, b) => a - b);
// The immutable patch's exact perimeter is a grid boundary, so no triangle can
// interpolate a raised outside corner onto its flat ground edge.
const terrainGrid = { originX: padded.minX, originZ: padded.minZ, step: 130, xs: coordinates(padded.minX, padded.maxX, [OLD.minX, OLD.maxX]), zs: coordinates(padded.minZ, padded.maxZ, [OLD.minZ, OLD.maxZ]) }, heights = new Map(), seamBlends = new Map();
// The two small reserve service buildings share one terrain cell on the western
// face. A gently sloping shoulder beneath that cell avoids tall foundations;
// changing the shared field also moves every trail and surface with the ground.
const ridgeShoulderSources = [588250241, 588250242], ridgeShoulderVertices = new Set();
for (const id of ridgeShoulderSources) {
  const ring = byId.get(id)?.geometry.map(point); if (!ring) continue;
  for (let ix = gridIndex(terrainGrid.xs, Math.min(...ring.map((p) => p[0]))); ix <= gridIndex(terrainGrid.xs, Math.max(...ring.map((p) => p[0]))) + 1; ix++) for (let iz = gridIndex(terrainGrid.zs, Math.min(...ring.map((p) => p[1]))); iz <= gridIndex(terrainGrid.zs, Math.max(...ring.map((p) => p[1]))) + 1; iz++) ridgeShoulderVertices.add(`${ix},${iz}`);
}
function gridHeight(ix, iz) {
  const key = `${ix},${iz}`;
  if (!heights.has(key)) {
    const x = terrainGrid.xs[ix], z = terrainGrid.zs[iz];
    heights.set(key, ridgeShoulderVertices.has(key) ? 305 + (x + 9710) * 0.025 + (z - 4230) * 0.012 : authoredHeight(x, z));
  }
  return heights.get(key);
}
function interpolateGrid(x, z, valueAt) {
  const ix = gridIndex(terrainGrid.xs, x), iz = gridIndex(terrainGrid.zs, z), u = (x - terrainGrid.xs[ix]) / (terrainGrid.xs[ix + 1] - terrainGrid.xs[ix]), v = (z - terrainGrid.zs[iz]) / (terrainGrid.zs[iz + 1] - terrainGrid.zs[iz]);
  const a = valueAt(ix, iz), b = valueAt(ix + 1, iz), c = valueAt(ix, iz + 1), d = valueAt(ix + 1, iz + 1);
  return u + v <= 1 ? a + (b - a) * u + (c - a) * v : d + (c - d) * (1 - u) + (b - d) * (1 - v);
}
const elevation = (x, z) => interpolateGrid(x, z, gridHeight);
function seamBlend(ix, iz) {
  const key = `${ix},${iz}`;
  if (!seamBlends.has(key)) { const x = terrainGrid.xs[ix], z = terrainGrid.zs[iz], d = Math.hypot(Math.max(OLD.minX - x, 0, x - OLD.maxX), Math.max(OLD.minZ - z, 0, z - OLD.maxZ)); seamBlends.set(key, smooth(d / 260)); }
  return seamBlends.get(key);
}
function surfaceElevation(x, z, lift, batch, color) {
  const current = typeof lift === "function" ? lift(x, z) : lift; let original = current;
  if (batch === "Mapped landcover") original = color === palette.campus ? 0.12 : color === palette.parking ? 0.18 : [palette.pitch, palette.track].includes(color) ? 0.24 : 0.05;
  if (batch === "Regional roads") {
    const shoulder = color === palette.walk && current < 2.2;
    original = shoulder ? 0.465 : color === palette.walk && current <= 2.2 ? 0.53 : 0.5 + Math.max(0, current - 2.2) * 5.4 / 2.5;
  }
  return elevation(x, z) + original + (current - original) * interpolateGrid(x, z, seamBlend);
}
const kit = createGeometryKit(elevation, padded, terrainGrid, surfaceElevation, clipLand), { add, flat, ribbon, rock } = kit;
const counts = { buildings: 0, detailedBuildings: 0, omittedRegionalBuildings: 0, roadsAndPaths: 0, waterwaySegments: 0, landcoverPolygons: 0, cliffFacets: 0, trees: 0, coastlineWays: coastWays.length };
const layout = { buildings: [], trees: [], terrainGrid, treeExclusionSourceIds: [], waterwaySourceIds: [], coastlineSourceIds: coastWays.map((f) => `way/${f.id}`), namedFeatures: [] };
let seed = 20261013;
const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
const tp = { minX: -10800, maxX: -7700, minZ: 2100, maxZ: 7000 };
const pv = { minX: -4200, maxX: 550, minZ: 1700, maxZ: 5150 };
const inRect = ([x, z], r) => x >= r.minX && x <= r.maxX && z >= r.minZ && z <= r.maxZ;
const focused = (p) => inRect(p, tp) || inRect(p, pv);

// Every terrain triangle clips against the coherent mainland and tidal-island
// rings. Multiple shoreline crossings in a latitude band remain distinct.
for (let iz = 0; iz + 1 < terrainGrid.zs.length; iz++) {
  const z = terrainGrid.zs[iz], z2 = terrainGrid.zs[iz + 1];
  for (let ix = 0; ix + 1 < terrainGrid.xs.length; ix++) {
    const x = terrainGrid.xs[ix], x2 = terrainGrid.xs[ix + 1], vertices = [];
    for (const triangle of [[[x, z], [x2, z], [x, z2]], [[x2, z], [x2, z2], [x, z2]]]) {
      for (const polygon of clipLand(triangle)) for (let k = 1; k + 1 < polygon.length; k++) for (const p of [polygon[0], polygon[k], polygon[k + 1]]) vertices.push(p[0], elevation(...p) - 0.03, p[1]);
    }
    if (vertices.length) { const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3)); add(g, palette.ground); }
  }
}
flat([[padded.minX, padded.minZ], [coast[0][0], padded.minZ], ...coast, [coast.at(-1)[0], padded.maxZ], [padded.minX, padded.maxZ]], palette.ocean, 0, "Pacific Ocean", coastalIslands, 0.4);
ribbon(coast, 75, palette.sand, 0.7, "Coastal beach");
ribbon(coast.map(([x, z]) => [x - 24, z]), 9, palette.surf, 0, "Coastal beach", 0.55);

function stitch(members) {
  const pending = members.map((m) => byId.get(Number(m.ref))?.geometry.map(point)).filter(Boolean), rings = [];
  while (pending.length) {
    const ring = pending.shift(); let progress = true;
    while (progress && distance(ring[0], ring.at(-1)) > 0.02) {
      progress = false;
      for (let i = 0; i < pending.length; i++) {
        const next = pending[i];
        if (distance(ring.at(-1), next[0]) < 0.02) { ring.push(...next.slice(1)); pending.splice(i, 1); progress = true; break; }
        if (distance(ring.at(-1), next.at(-1)) < 0.02) { ring.push(...next.toReversed().slice(1)); pending.splice(i, 1); progress = true; break; }
      }
    }
    if (distance(ring[0], ring.at(-1)) < 0.02) { const clipped = clipRing(ring, limits); if (clipped.length >= 3) rings.push(clipped); }
  }
  return rings;
}
const polygons = [], memberIds = new Set();
for (const f of source.elements.filter((f) => f.type === "relation")) {
  const outer = stitch(f.members.filter((m) => m.role !== "inner")), inner = stitch(f.members.filter((m) => m.role === "inner"));
  for (const ring of outer) polygons.push({ feature: f, ring, holes: inner.filter((h) => inside(h[0], ring)) });
  if (outer.length) f.members.forEach((m) => memberIds.add(Number(m.ref)));
}
for (const f of ways) {
  if (memberIds.has(f.id) || f.tags.building || f.tags.natural === "coastline" || !["landuse", "leisure", "natural", "water", "amenity"].some((k) => f.tags[k])) continue;
  const ring = f.geometry.map(point); if (distance(ring[0], ring.at(-1)) > 0.05) continue;
  const clipped = clipRing(ring, limits); if (clipped.length >= 3) polygons.push({ feature: f, ring: clipped, holes: [] });
}
const greens = [], waters = [], treeExclusions = [], waterSegments = [];
// Different semantic colors never share a depth plane. Equal-color overlaps
// use the exact same terrain triangles and normals, so they render identically.
const surfaceColors = [palette.scrub, palette.park, palette.meadow, palette.campus, palette.parking, palette.pitch, palette.track, palette.sand];
const surfaceLift = (color) => 0.3 + Math.max(0, surfaceColors.indexOf(color)) * 0.15;
for (const p of polygons) {
  const t = p.feature.tags; let color;
  if (t.natural === "water" || t.water || t.waterway === "riverbank" || t.leisure === "swimming_pool") { waters.push(p); continue; }
  if (t.natural === "wetland") color = palette.meadow;
  if (["scrub", "wood", "grassland"].includes(t.natural) || ["forest", "grass", "meadow", "recreation_ground"].includes(t.landuse) || ["park", "garden", "nature_reserve", "golf_course"].includes(t.leisure)) { color = t.natural === "scrub" || t.leisure === "nature_reserve" ? palette.scrub : t.landuse === "meadow" ? palette.meadow : palette.park; greens.push(p); }
  if (t.landuse === "retail" || t.amenity === "school" || t.amenity === "university") color = palette.campus;
  if (t.amenity === "parking") { color = palette.parking; treeExclusions.push(p); }
  if (["pitch", "track", "playground"].includes(t.leisure)) { color = t.leisure === "track" ? palette.track : palette.pitch; treeExclusions.push(p); }
  if (t.natural === "sand" || t.natural === "beach") color = palette.sand;
  if (color) { flat(p.ring, color, surfaceLift(color), "Mapped landcover", p.holes); counts.landcoverPolygons++; }
  if (t.name) layout.namedFeatures.push({ sourceId: `${p.feature.type}/${p.feature.id}`, name: t.name });
}
for (const p of waters) { flat(p.ring, palette.water, 2.3, "Lagoons and creeks", p.holes); counts.landcoverPolygons++; }
// Exposed western cliff facets use the existing warm rock colors, on the same
// terrain planes as vegetation and trails; they are not separate raised rocks.
for (let iz = 0; iz + 1 < terrainGrid.zs.length; iz++) {
  const z = terrainGrid.zs[iz], z2 = terrainGrid.zs[iz + 1]; if (z2 < 3450 || z > 5350) continue;
  for (let ix = 0; ix + 1 < terrainGrid.xs.length; ix++) {
    const x = terrainGrid.xs[ix], x2 = terrainGrid.xs[ix + 1];
    for (const triangle of [[[x, z], [x2, z], [x, z2]], [[x2, z], [x2, z2], [x, z2]]]) {
      const c = center(triangle), inland = c[0] - coastX(c[1]);
      if (inland < 210 || inland > 435 || torreyRidge(...c) < 0.12) continue;
      flat(triangle, palette.rock[1], 1.6, "Mapped landcover"); counts.cliffFacets++;
    }
  }
}
// At this regional scale mapped marsh drains and creeks need a legible minimum width.
for (const f of ways.filter((f) => f.tags.waterway && !["dam", "weir"].includes(f.tags.waterway))) {
  const points = f.geometry.map(point); if (!points.some((p) => inBounds(p))) continue;
  const named = /penasquitos|peñasquitos/i.test(f.tags.name ?? "");
  const width = named ? 20 : f.tags.waterway === "river" ? 16 : 8;
  ribbon(points, width, palette.water, 2.3, "Lagoons and creeks");
  for (let i = 1; i < points.length; i++) waterSegments.push({ a: points[i - 1], b: points[i], width });
  counts.waterwaySegments++; layout.waterwaySourceIds.push(`way/${f.id}`);
}

const buildingGrid = new Map(), roadGrid = new Map(), waterGrid = new Map(), surfaceExclusionGrid = new Map(), treeGrid = new Map();
function index(grid, item, points, margin = 0) {
  const xs = points.map((p) => p[0]), zs = points.map((p) => p[1]);
  for (let x = Math.floor((Math.min(...xs) - margin) / 80); x <= Math.floor((Math.max(...xs) + margin) / 80); x++) for (let z = Math.floor((Math.min(...zs) - margin) / 80); z <= Math.floor((Math.max(...zs) + margin) / 80); z++) {
    const key = `${x},${z}`; if (!grid.has(key)) grid.set(key, []); grid.get(key).push(item);
  }
}
for (const r of waterSegments) index(waterGrid, r, [r.a, r.b], r.width + 24);
for (const p of [...waters, ...treeExclusions]) index(surfaceExclusionGrid, p, p.ring, 24);
layout.treeExclusionSourceIds = [...treeExclusions, ...waters].map((p) => `${p.feature.type}/${p.feature.id}`);
const bridgeEnds = ways.filter((f) => f.tags.highway && f.tags.bridge === "yes").flatMap((f) => [point(f.geometry[0]), point(f.geometry.at(-1))]);
const walking = new Set(["path", "footway", "track", "steps", "cycleway", "pedestrian"]);
for (const f of ways.filter((f) => f.tags.highway && !["proposed", "construction"].includes(f.tags.highway))) {
  const rawPoints = f.geometry.map(point); if (!rawPoints.some((p) => inBounds(p)) || rawPoints.every((p) => inOld(p))) continue;
  const foot = walking.has(f.tags.highway), freeway = f.tags.highway.startsWith("motorway");
  const detailed = rawPoints.some(focused), points = simplify(rawPoints, detailed ? 1.5 : 6);
  const width = Math.max(foot ? (detailed ? 4 : 6) : 7, Math.min(30, Number.parseFloat(f.tags.width) || (freeway ? 16 : ["primary", "secondary", "trunk"].includes(f.tags.highway) ? 13 : 7)));
  // Planting exclusions retain every mapped road, including omitted coarse LOD.
  for (let i = 1; i < rawPoints.length; i++) { const r = { a: rawPoints[i - 1], b: rawPoints[i], width }; index(roadGrid, r, [r.a, r.b], width + 24); }
  if (foot && !detailed && f.id % 3) continue;
  if (f.tags.highway === "service" && !detailed && f.id % 3) continue;
  const approaches = !foot && f.tags.bridge !== "yes" ? bridgeEnds.filter((b) => distance(b, rawPoints[0]) < 0.1 || distance(b, rawPoints.at(-1)) < 0.1) : [];
  const bridgeLift = (x, z) => f.tags.bridge === "yes" ? 2.5 : Math.max(0, ...approaches.map((p) => 2.5 * Math.max(0, 1 - distance([x, z], p) / 70)));
  if (!foot) ribbon(points, width + (freeway ? 5 : 3), palette.walk, (x, z) => 2.1 + bridgeLift(x, z));
  ribbon(points, width, foot ? palette.walk : freeway ? palette.freeway : palette.road, (x, z) => 2.2 + bridgeLift(x, z));
  counts.roadsAndPaths++;
}
// All focus footprints are retained. Elsewhere one of every four small mapped
// houses supplies coarse texture; large buildings remain geographically exact.
for (const f of ways.filter((f) => f.tags.building && f.tags.building !== "no")) {
  const rawRing = clean(f.geometry.map(point)), c = center(rawRing); if (rawRing.length < 3 || !inBounds(c) || inOld(c)) continue;
  const detailed = focused(c), reduced = clean(simplify([...rawRing, rawRing[0]], detailed ? 0.6 : 1.8)), ring = reduced.length >= 3 ? reduced : rawRing;
  index(buildingGrid, rawRing, rawRing, 25);
  const area = Math.abs(ring.reduce((sum, a, i) => { const b = ring[(i + 1) % ring.length]; return sum + a[0] * b[1] - b[0] * a[1]; }, 0) / 2);
  if (!detailed && area < 1600 && f.id % 4 !== 0) { counts.omittedRegionalBuildings++; continue; }
  const height = Math.min(80, Math.max(4, Number.parseFloat(f.tags.height) || Number.parseFloat(f.tags["building:levels"]) * 2.8 || (area > 1600 ? 12 : 6.5)));
  const wallRing = ring.flatMap((a, i) => splitGridLine(a, ring[(i + 1) % ring.length], terrainGrid).slice(0, -1));
  const groundHeights = wallRing.map((p) => elevation(...p));
  const xs = ring.map((p) => p[0]), zs = ring.map((p) => p[1]);
  for (let ix = gridIndex(terrainGrid.xs, Math.min(...xs)); ix <= gridIndex(terrainGrid.xs, Math.max(...xs)) + 1; ix++) for (let iz = gridIndex(terrainGrid.zs, Math.min(...zs)); iz <= gridIndex(terrainGrid.zs, Math.max(...zs)) + 1; iz++) {
    const p = [terrainGrid.xs[ix], terrainGrid.zs[iz]]; if (inside(p, ring)) groundHeights.push(elevation(...p));
  }
  const minGround = Math.min(...groundHeights), maxGround = Math.max(...groundHeights), base = maxGround + 0.4, vertices = [];
  for (let i = 0; i < wallRing.length; i++) {
    const a = wallRing[i], b = wallRing[(i + 1) % wallRing.length];
    const p = [[a[0], elevation(...a) - 0.08, a[1]], [b[0], elevation(...b) - 0.08, b[1]], [b[0], base + height, b[1]], [a[0], base + height, a[1]]];
    for (const j of [0, 1, 2, 0, 2, 3]) vertices.push(...p[j]);
  }
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  const batch = detailed ? "District buildings" : "Regional buildings";
  add(geometry, palette.wall[f.id % palette.wall.length], batch);
  flat(ring, palette.roof[f.id % palette.roof.length], 0, batch, [], base + height + 0.04);
  counts.buildings++; if (detailed) counts.detailedBuildings++;
  layout.buildings.push({ sourceId: `way/${f.id}`, center: rounded([c[0], base, c[1]]), height, detailed, foundation: { minGround, maxGround, bottomOffset: -0.08, roofY: base + height + 0.04, edgeSegments: wallRing.length } });
}

function tree(p, size = 1, pine = false) {
  if (!inBounds(p, 30) || inOld(p, 18) || !isLand(p) || p[0] < coastX(p[1]) + 70) return false;
  const key = `${Math.floor(p[0] / 80)},${Math.floor(p[1] / 80)}`, radius = (pine ? 9 : 5) * size;
  if ((buildingGrid.get(key) ?? []).some((r) => inside(p, r) || r.some((a, i) => segmentDistance(p, a, r[(i + 1) % r.length]) < radius + 2))) return false;
  if ((roadGrid.get(key) ?? []).some((r) => segmentDistance(p, r.a, r.b) < r.width / 2 + radius + 2)) return false;
  if ((waterGrid.get(key) ?? []).some((r) => segmentDistance(p, r.a, r.b) < r.width / 2 + radius + 2)) return false;
  if ((treeGrid.get(key) ?? []).some((t) => distance(p, t.p) < radius + t.radius + 2)) return false;
  if ((surfaceExclusionGrid.get(key) ?? []).some((w) => (inside(p, w.ring) && !w.holes.some((h) => inside(p, h))) || [w.ring, ...w.holes].some((ring) => ring.some((a, i) => segmentDistance(p, a, ring[(i + 1) % ring.length]) < radius + 2)))) return false;
  const y = elevation(...p), height = (pine ? 19 : 11) * size;
  const trunk = new THREE.CylinderGeometry(size * 0.65, size, height * 0.8, 5); trunk.translate(p[0], y + height * 0.4, p[1]); add(trunk, palette.trunk, "Coastal pines and canyon trees");
  const crown = new THREE.IcosahedronGeometry(1, 0); crown.scale(radius, height * (pine ? 0.3 : 0.4), radius); crown.rotateY(random() * Math.PI); crown.translate(p[0], y + height * 0.8, p[1]); add(crown, palette.leaf[Math.floor(random() * palette.leaf.length)], "Coastal pines and canyon trees");
  index(treeGrid, { p, radius }, [p], radius + 24); layout.trees.push({ position: rounded([p[0], y, p[1]]), radius }); counts.trees++; return true;
}
for (const p of greens) {
  const xs = p.ring.map((n) => n[0]), zs = p.ring.map((n) => n[1]);
  const spacing = focused(center(p.ring)) ? 105 : 330;
  for (let x = Math.min(...xs) + spacing / 2; x < Math.max(...xs); x += spacing) for (let z = Math.min(...zs) + spacing / 2; z < Math.max(...zs); z += spacing) {
    const position = [x + (random() - 0.5) * spacing * 0.65, z + (random() - 0.5) * spacing * 0.65];
    if (inside(position, p.ring) && !p.holes.some((h) => inside(position, h)) && random() > 0.2) tree(position, focused(position) ? 1.4 : 2, inRect(position, tp));
  }
}
// A few coastal trees occupy the mapped reserve even where OSM only tags trails.
for (let z = 3300; z < 6900; z += 115) for (let d = 170; d < 650; d += 125) {
  const p = [coastX(z) + d + random() * 50, z + random() * 55]; if (random() > 0.25) tree(p, 1.3 + random() * 0.5, true);
}

const waterfall = source.elements.find((f) => f.type === "node" && f.id === 1863363847);
if (!waterfall || waterfall.tags.waterway !== "waterfall") throw new Error("Verified Peñasquitos waterfall source node is required");
const [wx, wz] = point(waterfall), wy = elevation(wx, wz);
const waterfallBatch = "Park Village canyon waterfall";
// Small creek-scale gorge, aligned with the mapped upstream/downstream segment.
// Keep five random draws per rock so every surrounding tree remains unchanged.
const waterfallCreek = waterSegments.reduce((nearest, segment) => segmentDistance([wx, wz], segment.a, segment.b) < segmentDistance([wx, wz], nearest.a, nearest.b) ? segment : nearest);
const creekLength = distance(waterfallCreek.a, waterfallCreek.b), downstream = waterfallCreek.b.map((v, i) => (v - waterfallCreek.a[i]) / creekLength), across = [downstream[1], -downstream[0]];
const waterfallPoint = (cross, along) => [wx + across[0] * cross + downstream[0] * along, wz + across[1] * cross + downstream[1] * along];
const creekAngle = Math.atan2(downstream[0], downstream[1]);
for (let i = 0; i < 20; i++) {
  const side = i % 2 ? 1 : -1, row = Math.floor(i / 2);
  const offset = 10.4 + random() * 3.4, rise = (4 + random() * 4.5) * 0.5;
  const radiusX = (3.2 + random() * 2.2) * 0.55, radiusZ = (3.4 + random() * 1.8) * 0.55, rotation = creekAngle + (random() - 0.5) * 0.5;
  const [x, z] = waterfallPoint(side * offset, -26 + row * 5.6), ground = elevation(x, z);
  // Dodecahedron dimensions are radii; its Y extent is +/-0.934172 of radius.
  // Set its bottom 0.8 m into local terrain and its visible top 2–4.25 m above it.
  const radiusY = (rise + 0.8) / (2 * 0.9341723589627157);
  rock(x, ground + (rise - 0.8) / 2, z, radiusX, radiusY, radiusZ, palette.rock[i % palette.rock.length], waterfallBatch, rotation);
}
const poolRing = [[-7, 10], [-10, 18], [-7, 28], [4, 30], [10, 22], [8, 11]].map(([cross, along]) => waterfallPoint(cross, along));
flat(poolRing, "#6aa8af", 2.42, waterfallBatch);
// A single continuous water ribbon enters from the existing creek, crosses
// three short ledges, then meets the pool. No disconnected box shelves.
const cascadeProfile = [[-26, 0], [-18, 1.2], [-10, 2.7], [-5, 2.7], [-5, 1.8], [0, 1.8], [0, 0.9], [5, 0.9], [5, 0], [17, 0]];
const cascadeVertex = (cross, along, rise, advance = 0) => { const p = waterfallPoint(cross, along + advance); return [p[0], elevation(...p) + 2.45 + rise, p[1]]; };
for (let i = 1; i < cascadeProfile.length; i++) {
  const [from, top] = cascadeProfile[i - 1], [to, bottom] = cascadeProfile[i], width = 7.5;
  const p = [cascadeVertex(-width / 2, from, top), cascadeVertex(width / 2, from, top), cascadeVertex(width / 2, to, bottom), cascadeVertex(-width / 2, to, bottom)];
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute("position", new THREE.Float32BufferAttribute([0, 1, 2, 0, 2, 3].flatMap((j) => p[j]), 3)); add(geometry, palette.water, waterfallBatch);
  if (from === to) {
    const foam = [cascadeVertex(-2.2, from, top - 0.1, 0.035), cascadeVertex(2.2, from, top - 0.1, 0.035), cascadeVertex(2.2, to, bottom + 0.08, 0.035), cascadeVertex(-2.2, to, bottom + 0.08, 0.035)];
    const spill = new THREE.BufferGeometry(); spill.setAttribute("position", new THREE.Float32BufferAttribute([0, 1, 2, 0, 2, 3].flatMap((j) => foam[j]), 3)); add(spill, palette.foam, waterfallBatch);
  }
}
for (let i = 0; i < 24; i++) { const angle = i * Math.PI * 2 / 24; const p = [wx + Math.cos(angle) * (90 + random() * 25), wz + Math.sin(angle) * (135 + random() * 20)]; tree(p, 1.4); }

const scene = kit.finish();
const contentBounds = new THREE.Box3().setFromObject(scene), groundBounds = scene.getObjectByName("Regional landscape").geometry.boundingBox;
const contentHeightRange = { min: Math.min(-5, Math.floor(contentBounds.min.y) - 1), max: Math.ceil(contentBounds.max.y) + 1 };
const groundHeightRange = { min: Math.floor(groundBounds.min.y), max: Math.ceil(groundBounds.max.y) };
const waterfallBounds = scene.getObjectByName(waterfallBatch).geometry.boundingBox;
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
await document.transform(dedup(), quantize({ pattern: /^(NORMAL|COLOR_0)$/, quantizeNormal: 8, quantizeColor: 8 }), weld(), prune(), reorder({ encoder: MeshoptEncoder, target: "size" }));
document.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.QUANTIZE });
await io.write(MODEL, document);
const glb = await fs.readFile(MODEL);
const boundsFor = (r, minY = -3, maxY = 180) => ({ min: rounded([r.minX, minY, r.minZ]), max: rounded([r.maxX, maxY, r.maxZ]) });
const districts = [
  { id: "torrey-highlands", label: "Torrey Highlands", markerPosition: [0, 100, 0], camera: { target: [0, 0, 0], azimuth: 0, height: 1200, radius: 1350, zoom: 0.65 }, bounds: boundsFor(OLD, -0.03, 60) },
  { id: "torrey-pines", label: "Torrey Pines", markerPosition: rounded([-9600, elevation(-9600, 4650) + 100, 4650]), camera: { target: [-9775, 115, 4350], azimuth: -0.62, height: 2115, radius: 3200, zoom: 0.32 }, bounds: boundsFor(tp, -3, contentHeightRange.max) },
  { id: "park-village", label: "Park Village", markerPosition: [-1750, 140, 2600], camera: { target: [-1850, 20, 3450], azimuth: 0, height: 2600, radius: 2950, zoom: 0.23 }, bounds: boundsFor(pv) },
];
const manifest = {
  version: 1, name: "Northern San Diego · Coast and canyons", modelUrl: "/models/san-diego/region.glb", contentHash: crypto.createHash("sha256").update(glb).digest("hex"), byteLength: glb.byteLength,
  attribution: "© OpenStreetMap contributors · Map3D (MIT)", source: { ...source, elements: undefined, snapshot: `/${SNAPSHOT.replace(/^public\//, "")}`, snapshotSha256: crypto.createHash("sha256").update(await fs.readFile(SNAPSHOT)).digest("hex") },
  projection: { type: "local-equirectangular", originLongitudeLatitude: ORIGIN, units: "meters", axes: "east +X, up +Y, north -Z", metersPerLatitudeDegree: M_LAT, metersPerLongitudeDegree: M_LON },
  geographicBounds: REGION, coverageBounds: boundsFor(limits, contentHeightRange.min, contentHeightRange.max), groundHeightRange, contentHeightRange, bounds: boundsFor(limits, -3, Math.max(230, contentHeightRange.max)), peripheralGeometryBounds: boundsFor(padded, contentHeightRange.min, contentHeightRange.max), originalPatchExclusion: boundsFor(OLD),
  overview: { target: rounded([(limits.minX + limits.maxX) / 2, 0, (limits.minZ + limits.maxZ) / 2]), azimuth: 0, height: 11500, radius: 13500, zoom: 0.042 }, districts,
  annotations: [{ label: "Peñasquitos Waterfall", view: "park-village", position: rounded([wx, wy + 80, wz]), sourceId: "node/1863363847" }],
  waterfall: { sourceId: "node/1863363847", sourceName: waterfall.tags.name, longitudeLatitude: [waterfall.lon, waterfall.lat], position: rounded([wx, wy, wz]), rootName: waterfallBatch, cameraViewId: null, bounds: { min: rounded(waterfallBounds.min.toArray()), max: rounded(waterfallBounds.max.toArray()) }, size: rounded(waterfallBounds.getSize(new THREE.Vector3()).toArray()), interpretation: "Photo-inspired, non-interactive low-poly canyon landmark, a small formation along the mapped creek, with low 2–4.25 m rock outcrops, a connected 2.7 m stepped cascade and a small pool. Rock radii are 55% of the previous version, with the same centers and 0.8 m terrain embed. Not a surveyed waterfall model.", supportingSourceUrl: "https://www.sandiego.gov/event/waterfall-rehabilitation-project-0" },
  surfaceRendering: { terrainGridMeters: terrainGrid.step, insertedGridLines: { x: [OLD.minX, OLD.maxX], z: [OLD.minZ, OLD.maxZ] }, method: "Landcover, roads, trails, beaches and streams are clipped at the same terrain-grid cells and diagonal as the base surface; all use its exact piecewise-planar interpolation.", shoreline: "Base terrain and landcover clip against the connected mainland coastline and five closed tidal-island rings, preserving multiple bank crossings through the San Dieguito estuary. Ocean and beach follow the coherent chain rather than latitude-sorted vertices.", oldPatchSeam: "The original perimeter is an explicit grid boundary at ground Y=-0.03. Semantic surface lifts blend to the original flat neighborhood heights over 260 m.", semanticLandcoverLifts: Object.fromEntries(surfaceColors.map((color) => [color, surfaceLift(color)])), originalSurfaceLifts: { park: 0.05, scrub: 0.05, meadow: 0.05, campus: 0.12, parking: 0.18, pitch: 0.24, track: 0.24, road: 0.5, walk: 0.53, shoulder: 0.465 }, roadShoulderLift: 2.1, roadLift: 2.2, waterLift: 2.3, bridgeApproachMeters: 70, sameColorOverlap: "Identical color and identical ground plane; different landcover colors have distinct heights." },
  lod: { smallRegionalBuildingSampling: "one in four by stable OSM ID", allFocusBuildingsRetained: true, footprintSimplificationMeters: { focused: 0.6, regional: 1.8 }, roadSimplificationMeters: { focused: 1.5, regional: 6 }, minorRegionalServiceAndTrailSampling: "one in three by stable OSM ID; all focus services and trails retained", buildingSurfaces: "Walls and one roof only; no invisible bottoms or duplicate top caps." },
  counts: { ...counts, meshes: scene.children.length, sourceElements: source.elements.length, sourceTiles: source.tileBounds.length }, palette,
  styleParity: { source: "/data/san-diego/manifest.json", rule: "Existing sage terrain, scrub/nature reserves, meadow, park, retail/campus, parking, sports, road, warm walls, terracotta roofs and foliage reuse the original semantic palette. No extra residential/commercial ground washes.", buildingFoundations: "Level roofs clear the maximum footprint terrain height. Wall bottoms split at every terrain-plane boundary and extend 0.08 m below the local terrain, eliminating floating downhill walls and buried uphill roofs.", treeExclusions: "All mapped buildings and roads (including omitted regional LOD), water polygons/streams, parking, sports, tracks, playgrounds and other canopies, with canopy-radius clearance." },
  torreyPinesRelief: { interpretation: "Intentionally enlarged, approximately 300 m coastal mountain; an artistic geographic illustration, not surveyed elevation or a DEM.", influence: { northSouthZ: [3150, 5700], inlandFromCoastMeters: [190, 1250], gridInterpolationHaloMeters: 185 }, form: "An elongated crest, steep west-facing rock cliff, east-facing descent and two diagonal gullies, tapered at both ends. Shoreline and lagoon remain low.", serviceBuildingShoulder: { sourceIds: ridgeShoulderSources.map((id) => `way/${id}`), terrainVertices: ridgeShoulderVertices.size, elevation: "A gently sloping shared-ground shoulder near 305 m avoids oversized service-building foundations." }, cliffColors: [palette.rock[1]], surfaceLift: 1.6, cameraElevationDegrees: Math.atan2(2000, 3200) * 180 / Math.PI },
  assumptions: ["Mapped coastline, waterways, roads, landcover and buildings derive from the checked-in ODbL OSM snapshot. Missing source footprints are not fabricated.", "Regional building LOD retains all focus-area footprints and large buildings, plus one in four smaller buildings elsewhere. Trees are deterministic artistic planting, checked against all mapped buildings and roads, water polygons and streams, sports surfaces, parking, playgrounds and neighboring canopies.", "Sage terrain uses artistic coastal-bluff and canyon relief, including the deliberately enlarged Torrey Pines ridge, not surveyed elevations. The original flat Torrey Highlands model is preserved byte-for-byte and the new model has an exact rectangular hole for it.", "An unselectable 2.5 km peripheral terrain skirt (5 km to the west) and endpoint-extrapolated ocean prevent the framed region from looking like a cut-out tile. Those outer margins contain no invented streets or buildings and are excluded from overview fitting bounds.", "Road and stream widths are exaggerated slightly for regional readability. Trails have 4–6 m widths, named Peñasquitos creek is 20 m wide, and building heights use explicit OSM values or 6.5/12 m defaults.", "The Park Village waterfall is merged static scenery, with creek-scale angular boulders, a short continuous cascade, restrained foam and a small pool inspired by supplied photographs. It has no separate zoom state or interactive root.", "Torrey Pines includes the actual mapped coast, beach, lagoon, reserve trails, low-poly bluff relief and supplemental broad-crowned pines."],
  compression: { extension: "EXT_meshopt_compression", positions: "lossless Float32", normals: "8-bit", colors: "8-bit" },
  originalModel: { modelUrl: oldManifest.modelUrl, contentHash: oldManifest.contentHash, byteLength: oldManifest.byteLength },
};
await fs.writeFile(`${DATA}/region-manifest.json`, JSON.stringify(manifest, null, 2) + "\n");
await fs.writeFile(`${DATA}/region-layout.json`, JSON.stringify({ ...layout, waterfall: manifest.waterfall, counts: manifest.counts }));
console.log(JSON.stringify({ counts: manifest.counts, byteLength: glb.byteLength, contentHash: manifest.contentHash, districts, waterfall: manifest.waterfall }, null, 2));
