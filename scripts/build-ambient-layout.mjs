import fs from "node:fs/promises";
import path from "node:path";
import * as THREE from "three";

const ROOT = process.cwd();
const [runtime, planimetrics, washingtonPark, unionPark, manhattanParks] = await Promise.all([
  "public/models/washington-city/runtime.json",
  "public/data/manhattan-planimetrics.json",
  "public/data/washington-square-park.json",
  "public/data/union-square-park.json",
  "public/data/manhattan-parks.json",
].map(async (file) => JSON.parse(await fs.readFile(path.join(ROOT, file), "utf8"))));

function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = Math.imul(state ^ (state >>> 15), 1 | state);
    state ^= state + Math.imul(state ^ (state >>> 7), 61 | state);
    return ((state ^ (state >>> 14)) >>> 0) / 4294967296;
  };
}

function pointInRing(x, z, ring) {
  let inside = false;
  for (let current = 0, previous = ring.length - 1; current < ring.length; previous = current, current += 1) {
    const [currentX, currentZ] = ring[current];
    const [previousX, previousZ] = ring[previous];
    if (((currentZ > z) !== (previousZ > z))
      && x < ((previousX - currentX) * (z - currentZ)) / (previousZ - currentZ) + currentX) inside = !inside;
  }
  return inside;
}

function createFootprintIndex(footprints, cellSize = 64) {
  const cells = new Map();
  for (const ring of footprints) {
    const xs = ring.map(([x]) => x); const zs = ring.map(([, z]) => z);
    const minX = Math.floor(Math.min(...xs) / cellSize); const maxX = Math.floor(Math.max(...xs) / cellSize);
    const minZ = Math.floor(Math.min(...zs) / cellSize); const maxZ = Math.floor(Math.max(...zs) / cellSize);
    for (let x = minX; x <= maxX; x += 1) for (let z = minZ; z <= maxZ; z += 1) {
      const key = `${x}:${z}`; const entries = cells.get(key) ?? []; entries.push(ring); cells.set(key, entries);
    }
  }
  return { cellSize, cells };
}

function collides(x, z, index, margin) {
  return [[0, 0], [margin, 0], [-margin, 0], [0, margin], [0, -margin]].some(([dx, dz]) => {
    const px = x + dx; const pz = z + dz;
    return (index.cells.get(`${Math.floor(px / index.cellSize)}:${Math.floor(pz / index.cellSize)}`) ?? [])
      .some((ring) => pointInRing(px, pz, ring));
  });
}

function validateTrees(park, count, seed) {
  const random = seededRandom(seed); const trees = []; const palette = [0x91ad72, 0xa5bf82, 0x7f9d67, 0xb2c990, 0x8eaa70];
  const rings = park.parkRings ?? []; const points = rings.flat();
  const bounds = { minX: Math.min(...points.map(([x]) => x)), maxX: Math.max(...points.map(([x]) => x)), minZ: Math.min(...points.map(([, z]) => z)), maxZ: Math.max(...points.map(([, z]) => z)) };
  const distanceToSegment = (x, z, from, to) => {
    const dx = to[0] - from[0]; const dz = to[1] - from[1]; const lengthSquared = dx * dx + dz * dz;
    const t = lengthSquared === 0 ? 0 : THREE.MathUtils.clamp(((x - from[0]) * dx + (z - from[1]) * dz) / lengthSquared, 0, 1);
    return Math.hypot(x - (from[0] + dx * t), z - (from[1] + dz * t));
  };
  const segments = park.paths.flatMap((entry) => entry.points.slice(1).map((to, index) => ({ from: entry.points[index], to, clearance: Math.min(entry.width, 6) / 2 + 4.4 })))
    .filter(({ from, to }) => [from, to].some(([x, z]) => x >= bounds.minX - 12 && x <= bounds.maxX + 12 && z >= bounds.minZ - 12 && z <= bounds.maxZ + 12));
  const fountainCenter = park.fountain ? park.fountain.ring.reduce((sum, [x, z]) => [sum[0] + x, sum[1] + z], [0, 0]).map((v) => v / park.fountain.ring.length) : [0, 0];
  const fountainRadius = park.fountain ? park.fountain.ring.reduce((sum, [x, z]) => sum + Math.hypot(x - fountainCenter[0], z - fountainCenter[1]), 0) / park.fountain.ring.length : 0;
  const archCenter = park.arch ? park.arch.footprint.slice(0, -1).reduce((sum, [x, z]) => [sum[0] + x, sum[1] + z], [0, 0]).map((v) => v / (park.arch.footprint.length - 1)) : [Infinity, Infinity];
  for (let attempt = 0; trees.length < count && attempt < count * 240; attempt += 1) {
    const x = THREE.MathUtils.lerp(bounds.minX, bounds.maxX, random()); const z = THREE.MathUtils.lerp(bounds.minZ, bounds.maxZ, random());
    const isTall = random() < 0.18; const crownSize = 0.68 + random() * 0.68;
    const crownScale = [crownSize * (0.86 + random() * 0.28), crownSize * (0.88 + random() * 0.38), crownSize * (0.86 + random() * 0.28)];
    const rx = 4.1 * crownScale[0] + 0.6; const rz = 4.1 * crownScale[2] + 0.6;
    if (!Array.from({ length: 24 }, (_, i) => [x + Math.cos(i / 24 * Math.PI * 2) * rx, z + Math.sin(i / 24 * Math.PI * 2) * rz]).every(([px, pz]) => rings.some((ring) => pointInRing(px, pz, ring)))) continue;
    if (Math.hypot(x - fountainCenter[0], z - fountainCenter[1]) < fountainRadius + 10 || Math.hypot(x - archCenter[0], z - archCenter[1]) < 16) continue;
    if (segments.some((segment) => distanceToSegment(x, z, segment.from, segment.to) < segment.clearance) || trees.some((tree) => Math.hypot(x - tree.x, z - tree.z) < 10.5)) continue;
    trees.push({ x, z, trunkScale: 0.78 + random() * 0.38, heightScale: isTall ? 1.45 + random() * 0.55 : 0.88 + random() * 0.22, crownScale, crownColor: palette[Math.floor(random() * palette.length)] });
  }
  if (trees.length !== count) throw new Error(`Validated only ${trees.length}/${count} trees`);
  return trees;
}

const washingtonTrees = validateTrees(washingtonPark, 88, 0x7ee5_2026);
// These frozen placements sit on the reconstructed Union Square edge but their
// crowns overlap the authoritative roadbed. Keep them out of the authored set;
// this is evaluated only when regenerating ambient-layout.ts, never at runtime.
const excludedUnionTreeIndices = new Set([0, 12, 14, 29, 34, 37, 38, 47, 50, 51, 64, 71, 80, 82, 84, 93]);
const unionTrees = validateTrees(unionPark, 96, 0x6a4d_2026)
  .filter((_, index) => !excludedUnionTreeIndices.has(index));
const treeFootprints = [...washingtonTrees, ...unionTrees].map(({ x, z }) => Array.from({ length: 10 }, (_, i) => [x + Math.cos(i / 10 * Math.PI * 2) * 3.2, z + Math.sin(i / 10 * Math.PI * 2) * 3.2]));

function validateContextTrees() {
  const random = seededRandom(0x4d41_2026); const trees = []; const palette = [0x91ad72, 0xa5bf82, 0x7f9d67, 0xb2c990, 0x8eaa70];
  const roadIndex = createFootprintIndex(planimetrics.roadbeds.map((roadbed) => roadbed.ring)); const buildingIndex = createFootprintIndex(runtime.footprints);
  const distanceToSegment = (x, z, from, to) => { const dx = to[0] - from[0]; const dz = to[1] - from[1]; const length = dx * dx + dz * dz; const t = length === 0 ? 0 : Math.max(0, Math.min(1, ((x - from[0]) * dx + (z - from[1]) * dz) / length)); return Math.hypot(x - from[0] - dx * t, z - from[1] - dz * t); };
  for (const park of manhattanParks.parkRings) {
    const ring = park.ring; const xs = ring.map(([x]) => x); const zs = ring.map(([, z]) => z); const minX = Math.min(...xs); const maxX = Math.max(...xs); const minZ = Math.min(...zs); const maxZ = Math.max(...zs);
    const area = Math.abs(ring.reduce((sum, point, i) => { const next = ring[(i + 1) % ring.length]; return sum + point[0] * next[1] - next[0] * point[1]; }, 0) / 2);
    const target = Math.max(1, Math.min(70, Math.round(area / 700))); const startCount = trees.length;
    const localPaths = manhattanParks.paths.flatMap((path) => path.points.slice(1).map((to, i) => ({ from: path.points[i], to, clearance: Math.min(path.width, 6) / 2 + 2.2 }))).filter(({ from, to }) => [from, to].some(([x, z]) => x >= minX - 8 && x <= maxX + 8 && z >= minZ - 8 && z <= maxZ + 8));
    for (let attempt = 0; trees.length < startCount + target && attempt < target * 500; attempt += 1) {
      const x = THREE.MathUtils.lerp(minX, maxX, random()); const z = THREE.MathUtils.lerp(minZ, maxZ, random()); const crownSize = 0.35 + random() * 0.65;
      const crownScale = [crownSize * (0.88 + random() * 0.24), crownSize * (0.9 + random() * 0.3), crownSize * (0.88 + random() * 0.24)]; const rx = 4.1 * crownScale[0] + 0.25; const rz = 4.1 * crownScale[2] + 0.25;
      const probes = Array.from({ length: 24 }, (_, i) => [x + Math.cos(i / 24 * Math.PI * 2) * rx, z + Math.sin(i / 24 * Math.PI * 2) * rz]);
      if (!probes.every(([px, pz]) => pointInRing(px, pz, ring) && !collides(px, pz, roadIndex, 0.2) && !collides(px, pz, buildingIndex, 0.5))) continue;
      if (localPaths.some((segment) => distanceToSegment(x, z, segment.from, segment.to) < segment.clearance) || trees.some((tree) => Math.hypot(x - tree.x, z - tree.z) < 7)) continue;
      const isTall = random() < 0.16;
      trees.push({ x, z, trunkScale: 0.7 + random() * 0.35, heightScale: isTall ? 1.35 + random() * 0.45 : 0.82 + random() * 0.24, crownScale, crownColor: palette[Math.floor(random() * palette.length)], park: park.name });
    }
  }
  return trees;
}
const contextTrees = validateContextTrees();
const populatedContextParks = new Set(contextTrees.map((tree) => tree.park));

function validatePedestrians() {
  const random = seededRandom(0x57a5_2026); const roads = createFootprintIndex(planimetrics.roadbeds.map((roadbed) => roadbed.ring));
  const obstacles = [...runtime.footprints, ...treeFootprints];
  if (washingtonPark.fountain) {
    const center = washingtonPark.fountain.ring.reduce((sum, [x, z]) => [sum[0] + x, sum[1] + z], [0, 0]).map((v) => v / washingtonPark.fountain.ring.length);
    const radius = washingtonPark.fountain.ring.reduce((sum, [x, z]) => sum + Math.hypot(x - center[0], z - center[1]), 0) / washingtonPark.fountain.ring.length + 2.5;
    obstacles.push(Array.from({ length: 24 }, (_, i) => [center[0] + Math.cos(i / 24 * Math.PI * 2) * radius, center[1] + Math.sin(i / 24 * Math.PI * 2) * radius]));
  }
  const buildings = createFootprintIndex(obstacles); const walkers = [];
  for (const area of [{ center: [0, 0], radius: 620, count: 300 }, { center: [545, -580], radius: 520, count: 300 }]) {
    const target = walkers.length + area.count;
    for (let attempt = 0; walkers.length < target && attempt < area.count * 220; attempt += 1) {
      const x = area.center[0] + (random() - 0.5) * area.radius * 2; const z = area.center[1] + (random() - 0.5) * area.radius * 2;
      if ((x - area.center[0]) ** 2 + (z - area.center[1]) ** 2 > area.radius ** 2) continue;
      const walker = { x, z, heading: random() * Math.PI * 2, phase: random() * Math.PI * 2, radius: 1.5 + random() * 5, speed: 0.18 + random() * 0.22 };
      if (Array.from({ length: 16 }, (_, i) => {
        const angle = i / 16 * Math.PI * 2; const px = x + Math.cos(angle) * walker.radius; const pz = z + Math.sin(angle) * walker.radius;
        return !collides(px, pz, roads, 1.2) && !collides(px, pz, buildings, 1.8);
      }).every(Boolean)) walkers.push(walker);
    }
    if (walkers.length !== target) throw new Error(`Validated only ${walkers.length}/${target} pedestrians`);
  }
  return walkers;
}

function validateTraffic() {
  const random = seededRandom(0xca45_2026); const buildings = createFootprintIndex(runtime.footprints); const routes = [];
  for (const roadbed of planimetrics.roadbeds) {
    const ring = roadbed.ring; if (ring.length < 4) continue;
    const center = ring.reduce((sum, [x, z]) => sum.add(new THREE.Vector2(x, z)), new THREE.Vector2()).multiplyScalar(1 / ring.length);
    let xx = 0; let xz = 0; let zz = 0;
    for (const [x, z] of ring) { const dx = x - center.x; const dz = z - center.y; xx += dx * dx; xz += dx * dz; zz += dz * dz; }
    const trace = xx + zz; const d = Math.sqrt((xx - zz) ** 2 + 4 * xz ** 2); const major = (trace + d) / 2; const minor = Math.max((trace - d) / 2, 0.001);
    if (major / minor < 2.4) continue;
    const angle = 0.5 * Math.atan2(2 * xz, xx - zz); const direction = new THREE.Vector2(Math.cos(angle), Math.sin(angle)); const perpendicular = new THREE.Vector2(-direction.y, direction.x);
    const projections = ring.map(([x, z]) => new THREE.Vector2(x, z).sub(center).dot(direction)); const minimum = Math.min(...projections); const maximum = Math.max(...projections); if (maximum - minimum < 28) continue;
    const samples = Array.from({ length: 121 }, (_, i) => { const point = center.clone().addScaledVector(direction, THREE.MathUtils.lerp(minimum, maximum, i / 120)); return { point, clear: [-1.45, 0, 1.45].every((offset) => { const probe = point.clone().addScaledVector(perpendicular, offset); return pointInRing(probe.x, probe.y, ring) && !roadbed.holes.some((hole) => pointInRing(probe.x, probe.y, hole)) && !collides(probe.x, probe.y, buildings, 3.2); }) }; });
    let bestStart = -1; let bestEnd = -1; let runStart = -1;
    samples.forEach((sample, i) => { if (sample.clear && runStart < 0) runStart = i; if ((!sample.clear || i === samples.length - 1) && runStart >= 0) { const end = sample.clear ? i : i - 1; if (end - runStart > bestEnd - bestStart) { bestStart = runStart; bestEnd = end; } runStart = -1; } });
    if (bestEnd - bestStart >= 8) routes.push({ start: samples[bestStart + 2].point, end: samples[bestEnd - 2].point });
  }
  const order = routes.map((route, i) => ({ i, angle: Math.atan2((route.start.y + route.end.y) / 2, (route.start.x + route.end.x) / 2), radius: route.start.clone().add(route.end).multiplyScalar(0.5).length() })).sort((a, b) => a.angle - b.angle || a.radius - b.radius);
  const count = 600;
  return Array.from({ length: count }, (_, i) => { const route = routes[order[Math.floor(i * order.length / count)].i]; const reversed = i % 2 === 1; return { start: reversed ? [route.end.x, route.end.y] : [route.start.x, route.start.y], end: reversed ? [route.start.x, route.start.y] : [route.end.x, route.end.y], speed: 0.025 + random() * 0.025, offset: (i * 0.61803398875) % 1 }; });
}

function validateParkPaths() {
  const roads = planimetrics.roadbeds;
  const parkRings = [...washingtonPark.parkRings, ...unionPark.parkRings];
  const onRoad = (x, z) => roads.some((road) => pointInRing(x, z, road.ring) && !road.holes.some((hole) => pointInRing(x, z, hole)));
  const inPark = (x, z) => parkRings.some((ring) => pointInRing(x, z, ring));
  return [...washingtonPark.paths, ...unionPark.paths].flatMap((entry) => entry.points.slice(1).map((to, i) => ({ from: entry.points[i], to, width: Math.min(entry.width, 6) }))).filter((segment) => {
    const dx = segment.to[0] - segment.from[0]; const dz = segment.to[1] - segment.from[1]; const length = Math.hypot(dx, dz); if (length === 0) return false;
    const ox = -dz / length * (segment.width / 2 + 0.25); const oz = dx / length * (segment.width / 2 + 0.25);
    return [0, 0.25, 0.5, 0.75, 1].every((p) => {
      const x = THREE.MathUtils.lerp(segment.from[0], segment.to[0], p); const z = THREE.MathUtils.lerp(segment.from[1], segment.to[1], p);
      return [
        [x, z],
        [x + ox, z + oz],
        [x - ox, z - oz],
      ].every(([probeX, probeZ]) => inPark(probeX, probeZ) && !onRoad(probeX, probeZ));
    });
  });
}

const output = { washingtonTrees, unionTrees, contextTrees, contextParkRings: manhattanParks.parkRings.filter(({ name }) => populatedContextParks.has(name)).map(({ ring }) => ring), pedestrians: validatePedestrians(), traffic: validateTraffic(), parkPaths: validateParkPaths() };
const source = `// Generated by scripts/build-ambient-layout.mjs. Do not edit manually.\nexport const AMBIENT_LAYOUT = ${JSON.stringify(output)} as const;\n`;
await fs.mkdir(path.join(ROOT, "src/generated"), { recursive: true });
await fs.writeFile(path.join(ROOT, "src/generated/ambient-layout.ts"), source);
console.log(`Validated and froze ${washingtonTrees.length + unionTrees.length + contextTrees.length} trees across ${populatedContextParks.size + 3} rendered park areas, ${output.pedestrians.length} pedestrians, ${output.traffic.length} vehicles, and ${output.parkPaths.length} park-path segments.`);
