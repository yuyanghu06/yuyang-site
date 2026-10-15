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
import { createLocalTerrain, torreyRidge as ridgeForm } from "./san-diego-region-terrain.mjs";
import { createTorreyRoadProfiles, createTorreyTrailProfiles, torreyRoadWidth } from "./san-diego-region-roads.mjs";
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
// Authored, localized mountain relief; this is an illustration, not DEM data.
const torreyRidge = (x, z) => ridgeForm(x, z, coastX);
const torreyRoads = createTorreyRoadProfiles(ways);
function authoredHeight(x, z) {
  const inland = x - coastX(z); if (inland < 15 || !isLand([x, z])) return -2;
  const hill = (hx, hz, radius, height) => height * Math.exp(-((x - hx) ** 2 + (z - hz) ** 2) / radius ** 2);
  let y = 24 + hill(-1700, -700, 2200, 90) + hill(3400, -2500, 1600, 150) + hill(-6300, 500, 2800, 70) + hill(-500, 6500, 3300, 85);
  // Coastal cliffs and canyon relief are artistic topography, not surveyed DEM.
  if (z > 2700 && z < 7800) y += 52 * Math.exp(-(((inland - 350) / 600) ** 2));
  const ridge = torreyRidge(x, z), summit = 135 + 8 * Math.cos((z - 4310) / 490);
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
// A compact oval shoulder blends into the surrounding crest. Its height comes
// from that crest instead of forcing a rectangular set of grid corners to 305m.
const ridgeShoulderSources = [588250241, 588250242], shoulderCenter = [-9687, 4281];
const shoulderHeight = torreyRoads.grade(...shoulderCenter, authoredHeight(...shoulderCenter));
const toiletCenter = center(clean(byId.get(348479240).geometry.map(point)));
const reserveShoulders = [
  { sourceIds: ridgeShoulderSources, center: shoulderCenter, height: shoulderHeight, coreRadius: 85, blendRadius: 235 },
  { sourceIds: [348479240], center: toiletCenter, height: torreyRoads.grade(...toiletCenter, authoredHeight(...toiletCenter)), coreRadius: 80, blendRadius: 170 },
];
function shoulderHeightAt(x, z) {
  let height = authoredHeight(x, z);
  for (const pad of reserveShoulders) {
    const radius = Math.hypot((x - pad.center[0]) / 1.05, z - pad.center[1]);
    const blend = 1 - smooth((radius - pad.coreRadius) / (pad.blendRadius - pad.coreRadius));
    const shoulder = pad.height + (x - pad.center[0]) * 0.018 + (z - pad.center[1]) * 0.012;
    height += (shoulder - height) * blend;
  }
  return height;
}
// Outlying campus footprints crossed the road grading bank. Local shallow
// shoulders carry those buildings without tall foundation walls.
const roadsideBuildingSources = [31801497, 31807666, 31816446, 31817270, 31819397, 31840352, 31842309, 31843592, 31844113, 31844645, 903058683, 903058685, 951599648, 1339936974, 31808711, 31806917, 31842503, 1339936971, 783749757, 31844079, 31840182];
const outlierRings = roadsideBuildingSources.map((id) => clean(byId.get(id).geometry.map(point)));
const roadsideBuildingPads = ways.filter((f) => f.tags.building && f.tags.building !== "no").flatMap((f) => {
  const ring = clean(f.geometry.map(point)), c = center(ring);
  if (c[0] < -8950 || c[0] > -8165 || c[1] < 5300 || c[1] > 6900) return [];
  if (!outlierRings.some((other) => ring.some((p) => other.some((q) => distance(p, q) < 100)))) return [];
  const original = interpolateGrid(...c, (ix, iz) => authoredHeight(terrainGrid.xs[ix], terrainGrid.zs[iz]));
  const height = [616941210, 783749760].includes(f.id) ? torreyRoads.nearest(...c).height : c[0] > -8300 || c[1] > 6500 ? original : torreyRoads.grade(...c, shoulderHeightAt(...c));
  const xs = ring.map((p) => p[0]), zs = ring.map((p) => p[1]);
  return [{ sourceId: `way/${f.id}`, ring, center: c, height, bounds: { minX: Math.min(...xs), maxX: Math.max(...xs), minZ: Math.min(...zs), maxZ: Math.max(...zs) } }];
});
// Adjacent footprint parts share a shoulder plane so their close edges cannot
// create conflicting, narrow terraces in the common terrain triangulation.
const padGroups = roadsideBuildingPads.map((_, i) => i);
const groupRoot = (i) => { while (padGroups[i] !== i) i = padGroups[i]; return i; };
for (let i = 0; i < roadsideBuildingPads.length; i++) for (let j = i + 1; j < roadsideBuildingPads.length; j++) {
  const a = roadsideBuildingPads[i], b = roadsideBuildingPads[j];
  const gap = Math.hypot(Math.max(a.bounds.minX - b.bounds.maxX, b.bounds.minX - a.bounds.maxX, 0), Math.max(a.bounds.minZ - b.bounds.maxZ, b.bounds.minZ - a.bounds.maxZ, 0));
  if (gap < 10 && a.center[1] < 6500 && b.center[1] < 6500) padGroups[groupRoot(j)] = groupRoot(i);
}
for (const root of new Set(padGroups.map((_, i) => groupRoot(i)))) {
  const group = roadsideBuildingPads.filter((_, i) => groupRoot(i) === root), anchor = group.reduce((a, b) => a.height > b.height ? a : b);
  let anchorHeight = anchor.height;
  for (const pad of group) for (const p of pad.ring) {
    const road = torreyRoads.nearest(...p);
    if (road?.distance < 45 && anchor.center[1] < 6500) anchorHeight = Math.max(anchorHeight, road.height + (p[1] - anchor.center[1]) * 0.015);
  }
  for (const pad of group) pad.height = anchorHeight + (pad.center[0] - anchor.center[0]) * 0.015 - (pad.center[1] - anchor.center[1]) * 0.015;
}
// This sidewalk bend sits just outside the paved core. Protect the shared
// terrain vertices around it without changing distant building shoulders.
const footwayShoulderGuard = { sourceId: "way/777620904", center: point(byId.get(777620904).geometry[7]), coreRadius: 40, blendRadius: 100, extraGuard: 8 };
function roadsideBuildingHeight(x, z, current, roadDistance) {
  let nearest = Infinity, total = 0, target = 0;
  for (const pad of roadsideBuildingPads) {
    if (x < pad.bounds.minX - 80 || x > pad.bounds.maxX + 80 || z < pad.bounds.minZ - 80 || z > pad.bounds.maxZ + 80) continue;
    const d = inside([x, z], pad.ring) ? 0 : Math.min(...pad.ring.map((p, i) => segmentDistance([x, z], p, pad.ring[(i + 1) % pad.ring.length])));
    if (d > 80) continue;
    nearest = Math.min(nearest, d);
    const weight = (1 - smooth(d / 80)) / (d + 0.1) ** 4;
    const height = pad.height + (x - pad.center[0]) * 0.015 - (z - pad.center[1]) * 0.015;
    total += weight; target += height * weight;
  }
  if (!total) return current;
  const guard = 24 + footwayShoulderGuard.extraGuard * (1 - smooth((distance([x, z], footwayShoulderGuard.center) - footwayShoulderGuard.coreRadius) / (footwayShoulderGuard.blendRadius - footwayShoulderGuard.coreRadius)));
  const weight = (1 - smooth((nearest - 16) / 64)) * smooth((roadDistance - guard) / 12) * smooth((-7955.027389990071 - x) / 50);
  return current + (target / total - current) * weight;
}
const torreyTrails = createTorreyTrailProfiles(ways, (x, z) => torreyRoads.grade(x, z, shoulderHeightAt(x, z)));
function localHeight(x, z) {
  const paved = torreyRoads.grade(x, z, shoulderHeightAt(x, z));
  const trail = torreyTrails.grade(x, z, paved), distanceToRoad = torreyRoads.nearest(x, z)?.distance ?? Infinity;
  let graded = paved + (trail - paved) * smooth((distanceToRoad - 24) / 26);
  graded = roadsideBuildingHeight(x, z, graded, distanceToRoad);
  if (z < 2994.752000000173 && x >= -10685.027389990071 && x <= -8215.027389990071) {
    const original = interpolateGrid(x, z, (ix, iz) => authoredHeight(terrainGrid.xs[ix], terrainGrid.zs[iz]));
    const blend = (1 - smooth((z - 2864.752000000173) / 130)) * smooth((distanceToRoad - 150) / 70);
    graded += (original - graded) * blend;
  }
  if (z > 6634.752000000173 && x >= -10685.027389990071 && x <= -7955.027389990071) {
    const original = interpolateGrid(x, z, (ix, iz) => authoredHeight(terrainGrid.xs[ix], terrainGrid.zs[iz]));
    graded += (original - graded) * smooth((z - 6634.752000000173) / 130);
  }
  // Keep the old coarse planes at the northern exterior. Resampling the
  // nonlinear coast height in that transition would raise the approach.
  if (z < 2600 && x >= -10685.027389990071 && x <= -8215.027389990071) {
    const original = interpolateGrid(x, z, (ix, iz) => authoredHeight(terrainGrid.xs[ix], terrainGrid.zs[iz]));
    return original + (graded - original) * smooth((z - 2344.752000000173) / (2600 - 2344.752000000173));
  }
  return graded;
}
function gridHeight(ix, iz) {
  const key = `${ix},${iz}`;
  if (!heights.has(key)) {
    const x = terrainGrid.xs[ix], z = terrainGrid.zs[iz];
    heights.set(key, localHeight(x, z));
  }
  return heights.get(key);
}
function interpolateGrid(x, z, valueAt) {
  const ix = gridIndex(terrainGrid.xs, x), iz = gridIndex(terrainGrid.zs, z), u = (x - terrainGrid.xs[ix]) / (terrainGrid.xs[ix + 1] - terrainGrid.xs[ix]), v = (z - terrainGrid.zs[iz]) / (terrainGrid.zs[iz + 1] - terrainGrid.zs[iz]);
  const a = valueAt(ix, iz), b = valueAt(ix + 1, iz), c = valueAt(ix, iz + 1), d = valueAt(ix + 1, iz + 1);
  return u + v <= 1 ? a + (b - a) * u + (c - a) * v : d + (c - d) * (1 - u) + (b - d) * (1 - v);
}
const buildingDivisions = (x, z) => roadsideBuildingPads.some(({ bounds: b }) => x >= b.minX - 130 && x <= b.maxX + 130 && z >= b.minZ - 130 && z <= b.maxZ + 130) ? 16 : 2;
// Freeze the accepted shared planes before refining only the parking frontage.
// New samples outside the local grading mask stay on those exact planes.
const baseDivisions = (x, z) => Math.max(torreyRoads.divisions(x, z), torreyTrails.divisions(x, z), buildingDivisions(x, z));
const previousGrid = { ...terrainGrid };
const previousTerrain = createLocalTerrain(previousGrid, { minX: -10480, maxX: -8190, minZ: 2400, maxZ: 6650 }, localHeight, baseDivisions);
const parkingRing = clean(byId.get(95479140).geometry.map(point));
const parkingAisleIds = [95479108, 95479114, 95479117, 95479118, 95479122, 95479145, 95479149, 95479152, 579001743];
const parkingFrontageIds = [660409108, 660409107, 201067341, 201067342, 201067343, 436308923, 436308926, 436308930, 436308931, 1090582161];
const parkingFrontageSegments = parkingFrontageIds.flatMap((id) => { const p = byId.get(id).geometry.map(point); return p.slice(1).map((b, i) => [p[i], b]); });
const parkingWaterRings = source.elements.filter((f) => f.tags?.natural === "water" || f.tags?.water || f.tags?.waterway === "riverbank").flatMap((f) => f.type === "way" ? [f.geometry.map(point)] : f.type === "relation" ? stitch(f.members.filter((m) => m.role !== "inner")) : []).filter((ring) => ring.some(([x, z]) => x > -10500 && x < -9500 && z > 2300 && z < 3250));
const parkingDistance = (x, z) => inside([x, z], parkingRing) ? 0 : Math.min(...parkingRing.map((p, i) => segmentDistance([x, z], p, parkingRing[(i + 1) % parkingRing.length])));
const parkingPlane = (x, z) => 11.5 + (x + 10075) * 0.02 - (z - 2765) * 0.002;
const parkingBounds = { minX: -10315, maxX: -9535, minZ: 2395, maxZ: 3070 };
function parkingHeight(x, z) {
  const original = previousTerrain.elevation(x, z) ?? localHeight(x, z);
  if (x < parkingBounds.minX || x > parkingBounds.maxX || z < parkingBounds.minZ || z > parkingBounds.maxZ) return original;
  const d = parkingDistance(x, z), pavedDistance = torreyRoads.nearest(x, z)?.distance ?? Infinity;
  const frontageDistance = Math.min(...parkingFrontageSegments.map(([a, b]) => segmentDistance([x, z], a, b)));
  const waterDistance = Math.min(...parkingWaterRings.map((ring) => inside([x, z], ring) ? 0 : Math.min(...ring.map((p, i) => segmentDistance([x, z], p, ring[(i + 1) % ring.length])))));
  const plane = parkingPlane(x, z), pad = 1 - smooth((d - 20) / 75);
  const frontage = (1 - smooth((frontageDistance - 24) / 70)) * (1 - smooth((d - 200) / 180));
  const target = plane + Math.max(0, d - 12) * 0.13;
  const graded = original + (Math.min(original, target) - original) * frontage;
  const result = graded + (target - graded) * pad;
  const guard = smooth((pavedDistance - 16) / 8) * smooth((waterDistance - 3) / 3);
  const boundary = Math.min(x - parkingBounds.minX, parkingBounds.maxX - x, z - parkingBounds.minZ, parkingBounds.maxZ - z);
  return original + (result - original) * guard * smooth(boundary / 20);
}
const parkingDivisions = (x, z) => parkingDistance(x, z) < 90 ? 32 : x > parkingBounds.minX - 130 && x < parkingBounds.maxX + 130 && z > parkingBounds.minZ - 130 && z < parkingBounds.maxZ + 130 ? 16 : 2;
const localTerrain = createLocalTerrain(terrainGrid, { minX: -10480, maxX: -8190, minZ: 2400, maxZ: 6650 }, parkingHeight, (x, z) => Math.max(baseDivisions(x, z), parkingDivisions(x, z)));
const priorCells = new Map(previousTerrain.refinement.cells.map((cell) => [cell.indices.join(","), cell.triangles]));
const parkingChangedCells = localTerrain.refinement.cells.filter((cell) => {
  const prior = priorCells.get(cell.indices.join(","));
  return prior.length !== cell.triangles.length || cell.triangles.some((triangle, i) => triangle.some((p, j) => p.some((v, k) => Math.abs(v - prior[i][j][k]) > 1e-8)));
});
const parkingMeshBounds = { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity };
for (const cell of parkingChangedCells) for (const triangle of cell.triangles) for (const [x, , z] of triangle) {
  parkingMeshBounds.minX = Math.min(parkingMeshBounds.minX, x); parkingMeshBounds.maxX = Math.max(parkingMeshBounds.maxX, x);
  parkingMeshBounds.minZ = Math.min(parkingMeshBounds.minZ, z); parkingMeshBounds.maxZ = Math.max(parkingMeshBounds.maxZ, z);
}
const elevation = (x, z) => localTerrain.elevation(x, z) ?? interpolateGrid(x, z, gridHeight);
const cellTriangles = (ix, iz) => localTerrain.trianglesAt(ix, iz) ?? [
  [[terrainGrid.xs[ix], terrainGrid.zs[iz]], [terrainGrid.xs[ix + 1], terrainGrid.zs[iz]], [terrainGrid.xs[ix], terrainGrid.zs[iz + 1]]],
  [[terrainGrid.xs[ix + 1], terrainGrid.zs[iz]], [terrainGrid.xs[ix + 1], terrainGrid.zs[iz + 1]], [terrainGrid.xs[ix], terrainGrid.zs[iz + 1]]],
];
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
const layout = { buildings: [], trees: [], parking: { sourceId: "way/95479140", ring: parkingRing, aisleSourceIds: parkingAisleIds.map((id) => `way/${id}`), frontageSourceIds: parkingFrontageIds.map((id) => `way/${id}`), influenceBounds: parkingBounds, meshInfluenceBounds: parkingMeshBounds, propInfluenceBounds: Object.fromEntries(Object.entries(parkingMeshBounds).map(([key, value]) => [key, value + (key.startsWith("min") ? -50 : 50)])), changedCellCount: parkingChangedCells.length, padSpacingMeters: 4.0625, frontageSpacingMeters: 8.125, plane: { origin: [-10075, 11.5, 2765], gradientX: 0.02, gradientZ: -0.002 } }, roadProfiles: torreyRoads.profiles, trailProfiles: torreyTrails.profiles, roadsideBuildingShoulders: roadsideBuildingPads.map(({ sourceId, center, height }) => ({ sourceId, center, height })), roadWidths: [], terrainGrid, treeExclusionSourceIds: [], waterwaySourceIds: [], coastlineSourceIds: coastWays.map((f) => `way/${f.id}`), namedFeatures: [] };
let seed = 20261013;
const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
const tp = { minX: -10800, maxX: -7700, minZ: 2100, maxZ: 7000 };
const pv = { minX: -4200, maxX: 550, minZ: 1700, maxZ: 5150 };
const inRect = ([x, z], r) => x >= r.minX && x <= r.maxX && z >= r.minZ && z <= r.maxZ;
const focused = (p) => inRect(p, tp) || inRect(p, pv);

// Every terrain triangle clips against the coherent mainland and tidal-island
// rings. Multiple shoreline crossings in a latitude band remain distinct.
for (let iz = 0; iz + 1 < terrainGrid.zs.length; iz++) {
  for (let ix = 0; ix + 1 < terrainGrid.xs.length; ix++) {
    const vertices = [];
    for (const triangle of cellTriangles(ix, iz)) {
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
// Whole steep terrain facets share one sandstone color. Classifying the actual
// refined face slopes keeps narrow green wedges out of the exposed cliff.
for (const cell of localTerrain.refinement.cells) for (const xyz of cell.triangles) {
  const triangle = xyz.map(([x, , z]) => [x, z]), c = center(triangle), inland = c[0] - coastX(c[1]);
  const [a, b, d] = xyz, dx = b[0] - a[0], dz = b[2] - a[2], ex = d[0] - a[0], ez = d[2] - a[2];
  const gradientX = ((b[1] - a[1]) * ez - (d[1] - a[1]) * dz) / (dx * ez - ex * dz);
  if (inland < 165 || inland > 670 || torreyRidge(...c) < 0.035 || gradientX < 0.28) continue;
  flat(triangle, palette.rock[1], 1.6, "Mapped landcover"); counts.cliffFacets++;
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
  const detailed = rawPoints.some(focused), localRoad = rawPoints.every(([x, z]) => x >= tp.minX + 30 && x <= tp.maxX - 30 && z >= tp.minZ + 30 && z <= tp.maxZ - 30), points = localRoad ? rawPoints : simplify(rawPoints, detailed ? 1.5 : 6);
  const width = Math.max(foot ? (detailed ? 4 : 6) : 7, Math.min(30, Number.parseFloat(f.tags.width) || (freeway ? 16 : ["primary", "secondary", "trunk"].includes(f.tags.highway) ? 13 : 7)));
  // Planting exclusions retain every mapped road, including omitted coarse LOD.
  for (let i = 1; i < rawPoints.length; i++) { const r = { a: rawPoints[i - 1], b: rawPoints[i], width }; index(roadGrid, r, [r.a, r.b], width + 24); }
  if (foot && !detailed && f.id % 3) continue;
  if (f.tags.highway === "service" && !detailed && f.id % 3) continue;
  const approaches = (!foot || localRoad) && f.tags.bridge !== "yes" ? bridgeEnds.filter((b) => localRoad ? rawPoints.some((p) => distance(b, p) < 100) : distance(b, rawPoints[0]) < 0.1 || distance(b, rawPoints.at(-1)) < 0.1) : [];
  const bridgeLift = (x, z) => f.tags.bridge === "yes" ? 2.5 : Math.max(0, ...approaches.map((p) => 2.5 * Math.max(0, 1 - distance([x, z], p) / 70)));
  const pavedWidth = localRoad ? torreyRoadWidth(f, width) : width;
  if (!foot) ribbon(points, pavedWidth + (localRoad ? 1.2 : freeway ? 5 : 3), palette.walk, (x, z) => 2.1 + bridgeLift(x, z), "Regional roads", null, localRoad);
  ribbon(points, pavedWidth, foot ? palette.walk : freeway ? palette.freeway : palette.road, (x, z) => 2.2 + bridgeLift(x, z), "Regional roads", null, localRoad);
  if (localRoad) layout.roadWidths.push({ sourceId: `way/${f.id}`, width: pavedWidth, shoulderWidth: foot ? 0 : 1.2, sourceWidth: f.tags.width ?? null, sourceLanes: f.tags.lanes ?? null, centerline: rawPoints, highway: f.tags.highway, name: f.tags.name ?? null, joined: true });
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
    for (const triangle of localTerrain.trianglesAt(ix, iz) ?? []) for (const q of triangle) if (inside(q, ring)) groundHeights.push(elevation(...q));
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
  surfaceRendering: { terrainGridMeters: terrainGrid.step, insertedGridLines: { x: [OLD.minX, OLD.maxX], z: [OLD.minZ, OLD.maxZ] }, method: "Landcover, roads, trails, beaches and streams share the base terrain triangle planes. Torrey Pines uses local conforming 65 m refinement, approximately 8.125 m subdivisions near reserve roads/named trails, and alternate diagonals; the rest retains its original 130 m grid. All draping, foundation splitting and elevation queries use that same triangulation.", shoreline: "Base terrain and landcover clip against the connected mainland coastline and five closed tidal-island rings, preserving multiple bank crossings through the San Dieguito estuary. Ocean and beach follow the coherent chain rather than latitude-sorted vertices.", oldPatchSeam: "The original perimeter is an explicit grid boundary at ground Y=-0.03. Semantic surface lifts blend to the original flat neighborhood heights over 260 m.", semanticLandcoverLifts: Object.fromEntries(surfaceColors.map((color) => [color, surfaceLift(color)])), originalSurfaceLifts: { park: 0.05, scrub: 0.05, meadow: 0.05, campus: 0.12, parking: 0.18, pitch: 0.24, track: 0.24, road: 0.5, walk: 0.53, shoulder: 0.465 }, roadShoulderLift: 2.1, roadLift: 2.2, waterLift: 2.3, bridgeApproachMeters: 70, sameColorOverlap: "Identical color and identical ground plane; different landcover colors have distinct heights." },
  lod: { smallRegionalBuildingSampling: "one in four by stable OSM ID", allFocusBuildingsRetained: true, footprintSimplificationMeters: { focused: 0.6, regional: 1.8 }, roadSimplificationMeters: { focused: 1.5, regional: 6 }, minorRegionalServiceAndTrailSampling: "one in three by stable OSM ID; all focus services and trails retained", buildingSurfaces: "Walls and one roof only; no invisible bottoms or duplicate top caps." },
  counts: { ...counts, meshes: scene.children.length, sourceElements: source.elements.length, sourceTiles: source.tileBounds.length }, palette,
  styleParity: { source: "/data/san-diego/manifest.json", rule: "Existing sage terrain, scrub/nature reserves, meadow, park, retail/campus, parking, sports, road, warm walls, terracotta roofs and foliage reuse the original semantic palette. No extra residential/commercial ground washes.", buildingFoundations: "Level roofs clear the maximum footprint terrain height. Wall bottoms split at every terrain-plane boundary and extend 0.08 m below the local terrain, eliminating floating downhill walls and buried uphill roofs.", treeExclusions: "All mapped buildings and roads (including omitted regional LOD), water polygons/streams, parking, sports, tracks, playgrounds and other canopies, with canopy-radius clearance." },
  torreyPinesRoads: { interpretation: torreyRoads.interpretation, gradingBounds: torreyRoads.bounds, sourceIds: torreyRoads.profiles.map((r) => r.sourceId), profileLayoutPath: "/data/san-diego/region-layout.json#roadProfiles", widthLayoutPath: "/data/san-diego/region-layout.json#roadWidths", trailProfileLayoutPath: "/data/san-diego/region-layout.json#trailProfiles", trails: "Only the reference named Guy Fleming, Parry Grove and Beach Trail routes and High Point approach receive contour benches. Mapped steps remain distinct. Trail grading is disabled within 24 m of paved road cores and blends in over the next 26 m.", corridorBlend: "Continuous finite-width weighting, including overlapping road cores; compatible adjacent main/Park profiles avoid nearest-family vertical fins.", bridgeApproaches: "70 m ramps carry the same bridge-end influence across adjacent source-way boundaries, including connected local footways.", centerlines: "Exact mapped vertices/endpoints, no blanket curves or simplification for Torrey Pines ways.", profileTargets: { mainMaximumGrade: 0.12, parkMaximumGrade: 0.15, pavedMaximumCrossfall: 0.08, scope: "Illustrative reserve-core targets, not surveyed engineering values. The northern exterior preserves its previous coarse ground planes and pre-existing crossfall through Z=2344.752 m, then blends into the revised profile by Z=2600 m." }, buildingShoulders: { footwayGuard: footwayShoulderGuard, sourceIds: roadsideBuildingPads.map((p) => p.sourceId), layoutPath: "/data/san-diego/region-layout.json#roadsideBuildingShoulders", description: "Footprint-following shared-ground accommodations prevent road grading banks from producing oversized foundations. Adjacent footprint parts share a gentle plane; unchanged nearby footprints constrain the blend. Paved road cores within 24 m are protected, with a localized 32 m shared-triangle guard at the adjacent way/777620904 sidewalk bend. Northern houses retain the previous coarse terrain planes; the southern exterior blends to those planes over Z=6634.752–6764.752 m." }, northernTransition: { preservedThroughZ: 2344.752000000173, profileBlendCompleteZ: 2600, method: "Previous 130 m triangle planes and an unsplit exterior diagonal preserve the existing approach height and longitudinal grade; its pre-existing peripheral crossfall is intentionally retained." }, joins: "Shared bounded miter cross-sections, at most twice the half width.", widthRule: "Explicit OSM width first; lane-based primary carriageways; 3.6–5.8 m reserve roads and 1.5–2.6 m paths. Planting exclusions retain previous conservative widths and random sequence." },
  torreyPinesParking: { ...layout.parking, layoutPath: "/data/san-diego/region-layout.json#parking", interpretation: "A shallow mapped parking pad and connected entrance/frontage grade use the same terrain as aisles, buildings and trees. The pad follows a 2.01% plane; shared 4.0625 m pad cells and 8.125 m frontage cells transition conformingly into the accepted terrain. Coastal-road cores and mapped lagoon water are guarded, and the grading mask fades to zero at its bounds. Mc Gonigle and its immediate Carmel Valley/Del Mar junction share the entrance grade before blending back to existing roads. Steeper grades remain where the immediate Del Mar and Carmel Valley frontage reconnects to surrounding roads; the shallow lot and Mc Gonigle access are the focus of this local correction. This is an illustrative grading correction, not surveyed elevation." },
  torreyPinesRelief: { interpretation: "Raised coastal bluff reduced to approximately 140 m to fit the reference road and reserve relationships; an artistic geographic illustration, not surveyed elevation or a DEM.", influence: { northSouthZ: [3150, 5700], inlandFromCoastMeters: [190, 1250], gridInterpolationHaloMeters: 185 }, refinement: { ...localTerrain.refinement, cells: undefined, geometryInfluenceBounds: Object.fromEntries(Object.entries(localTerrain.refinement.bounds).map(([key, value]) => [key, value + (key.startsWith("min") ? -50 : 50)])), geometryInfluenceNote: "Conservative 50 m halo includes whole buildings and tree crowns that straddle the ground refinement boundary; ground triangles change only inside refinement bounds.", triangleCount: localTerrain.refinement.cells.reduce((sum, cell) => sum + cell.triangles.length, 0), cellCount: localTerrain.refinement.cells.length, vertexOffsetMeters: 7, layoutPath: "/data/san-diego/region-layout.json#terrainGrid/refinement" }, form: "A broad, gently meandering crest, steep west-facing sandstone cliff, descending eastern shoulders and several tapered, branching ravines. Both ends blend into the low beach and lagoon surroundings.", serviceBuildingShoulder: { sourceIds: ridgeShoulderSources.map((id) => `way/${id}`), center: shoulderCenter, coreRadiusMeters: 85, blendRadiusMeters: 235, elevation: shoulderHeight, additionalShoulders: reserveShoulders.slice(1), description: "A small oval shoulder follows the adjacent crest height and gently blends into it, keeping service-building foundations low without a forced rectangular terrace." }, cliffColors: [palette.rock[1]], surfaceLift: 1.6, cameraElevationDegrees: Math.atan2(2000, 3200) * 180 / Math.PI },
  assumptions: ["Mapped coastline, waterways, roads, landcover and buildings derive from the checked-in ODbL OSM snapshot. Missing source footprints are not fabricated.", "Regional building LOD retains all focus-area footprints and large buildings, plus one in four smaller buildings elsewhere. Trees are deterministic artistic planting, checked against all mapped buildings and roads, water polygons and streams, sports surfaces, parking, playgrounds and neighboring canopies.", "Sage terrain uses artistic coastal-bluff and canyon relief, including the reference-informed raised Torrey Pines bluff, not surveyed elevations. The original flat Torrey Highlands model is preserved byte-for-byte and the new model has an exact rectangular hole for it.", "An unselectable 2.5 km peripheral terrain skirt (5 km to the west) and endpoint-extrapolated ocean prevent the framed region from looking like a cut-out tile. Those outer margins contain no invented streets or buildings and are excluded from overview fitting bounds.", "Road and stream widths are exaggerated slightly for regional readability. Trails have 4–6 m widths, named Peñasquitos creek is 20 m wide, and building heights use explicit OSM values or 6.5/12 m defaults.", "The Park Village waterfall is merged static scenery, with creek-scale angular boulders, a short continuous cascade, restrained foam and a small pool inspired by supplied photographs. It has no separate zoom state or interactive root.", "Torrey Pines includes the actual mapped coast, beach, lagoon, reserve trails, low-poly bluff relief and supplemental broad-crowned pines."],
  compression: { extension: "EXT_meshopt_compression", positions: "lossless Float32", normals: "8-bit", colors: "8-bit" },
  originalModel: { modelUrl: oldManifest.modelUrl, contentHash: oldManifest.contentHash, byteLength: oldManifest.byteLength },
};
await fs.writeFile(`${DATA}/region-manifest.json`, JSON.stringify(manifest, null, 2) + "\n");
await fs.writeFile(`${DATA}/region-layout.json`, JSON.stringify({ ...layout, waterfall: manifest.waterfall, counts: manifest.counts }));
console.log(JSON.stringify({ counts: manifest.counts, byteLength: glb.byteLength, contentHash: manifest.contentHash, districts, waterfall: manifest.waterfall }, null, 2));
