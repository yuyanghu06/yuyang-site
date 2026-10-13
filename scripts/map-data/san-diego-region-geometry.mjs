/** Shared geometry primitives for the offline San Diego regional generator. */
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

export const ORIGIN = [-117.1518, 32.9606];
export const M_LAT = 111320;
export const M_LON = M_LAT * Math.cos(ORIGIN[1] * Math.PI / 180);
export const point = ({ lat, lon }) => [(lon - ORIGIN[0]) * M_LON, -(lat - ORIGIN[1]) * M_LAT];
export const round = (v) => Math.round(v * 1000) / 1000;
export const rounded = (values) => values.map(round);
export const clean = (ring) => ring.filter((p, i) => (!i || distance(p, ring[i - 1]) > 0.02) && (i < ring.length - 1 || distance(p, ring[0]) > 0.02));
export const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
export const center = (ring) => ring.reduce((a, p) => [a[0] + p[0] / ring.length, a[1] + p[1] / ring.length], [0, 0]);
export const OLD = { minX: (-117.163 - ORIGIN[0]) * M_LON, maxX: (-117.138 - ORIGIN[0]) * M_LON, minZ: -(32.971 - ORIGIN[1]) * M_LAT, maxZ: -(32.951 - ORIGIN[1]) * M_LAT };
export function inside([x, z], ring) {
  let value = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, zi] = ring[i], [xj, zj] = ring[j];
    if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) value = !value;
  }
  return value;
}
export const inOld = ([x, z], margin = 0) => x >= OLD.minX - margin && x <= OLD.maxX + margin && z >= OLD.minZ - margin && z <= OLD.maxZ + margin;
export function segmentDistance(p, a, b) {
  const dx = b[0] - a[0], dz = b[1] - a[1];
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / (dx * dx + dz * dz || 1)));
  return Math.hypot(p[0] - a[0] - dx * t, p[1] - a[1] - dz * t);
}
export function simplify(points, tolerance) {
  if (points.length < 3) return points;
  const keep = new Set([0, points.length - 1]), pending = [[0, points.length - 1]];
  while (pending.length) {
    const [first, last] = pending.pop(); let farthest = -1, maximum = tolerance;
    for (let i = first + 1; i < last; i++) { const d = segmentDistance(points[i], points[first], points[last]); if (d > maximum) { maximum = d; farthest = i; } }
    if (farthest !== -1) { keep.add(farthest); pending.push([first, farthest], [farthest, last]); }
  }
  return [...keep].sort((a, b) => a - b).map((i) => points[i]);
}
export function gridIndex(coordinates, value) {
  let low = 0, high = coordinates.length - 1;
  while (high - low > 1) { const middle = (low + high) >> 1; if (coordinates[middle] <= value) low = middle; else high = middle; }
  return Math.max(0, Math.min(coordinates.length - 2, low));
}
// Split foundation edges wherever the shared terrain changes plane.
export function splitGridLine(a, b, grid) {
  const times = [0, 1], delta = b.map((v, i) => v - a[i]);
  for (const [axis, coordinates] of [[0, grid.xs], [1, grid.zs]]) {
    if (Math.abs(delta[axis]) < 1e-9) continue;
    for (let i = gridIndex(coordinates, Math.min(a[axis], b[axis])) + 1; i <= gridIndex(coordinates, Math.max(a[axis], b[axis])); i++) {
      const t = (coordinates[i] - a[axis]) / delta[axis]; if (t > 0 && t < 1) times.push(t);
    }
  }
  const boundaries = [...new Set(times)].sort((u, v) => u - v);
  for (let i = 1; i < boundaries.length; i++) {
    const t0 = boundaries[i - 1], t1 = boundaries[i], middle = (t0 + t1) / 2, p = a.map((v, j) => v + delta[j] * middle);
    const ix = gridIndex(grid.xs, p[0]), iz = gridIndex(grid.zs, p[1]), x = grid.xs[ix], z = grid.zs[iz], width = grid.xs[ix + 1] - x, depth = grid.zs[iz + 1] - z;
    const side = (t) => (a[0] + delta[0] * t - x) / width + (a[1] + delta[1] * t - z) / depth - 1;
    const first = side(t0), last = side(t1);
    if (first * last < -1e-12) times.push(t0 + (t1 - t0) * first / (first - last));
  }
  return [...new Set(times)].sort((u, v) => u - v).map((t) => a.map((v, i) => v + delta[i] * t));
}
export function clipRing(input, limits) {
  let ring = input;
  for (const [axis, limit, sign] of [[0, limits.minX, 1], [0, limits.maxX, -1], [1, limits.minZ, 1], [1, limits.maxZ, -1]]) {
    const output = [];
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i], b = ring[(i + 1) % ring.length], ain = sign * (a[axis] - limit) >= 0, bin = sign * (b[axis] - limit) >= 0;
      if (ain) output.push(a);
      if (ain !== bin) { const t = (limit - a[axis]) / (b[axis] - a[axis]); output.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]); }
    }
    ring = output;
  }
  return clean(ring);
}
// OSM coastline follows the mainland through tidal inlets, while closed ways
// describe islands. Preserve that topology; sorting all vertices by latitude
// would incorrectly join opposite banks and flood intervening neighborhoods.
export function createCoastalGeography(ways, limits) {
  const islands = [], pending = [];
  for (const points of ways) (distance(points[0], points.at(-1)) < 0.02 ? islands : pending).push(points);
  let first = 0;
  for (let i = 1; i < pending.length; i++) if (Math.min(pending[i][0][1], pending[i].at(-1)[1]) < Math.min(pending[first][0][1], pending[first].at(-1)[1])) first = i;
  const mainland = pending.splice(first, 1)[0];
  if (mainland[0][1] > mainland.at(-1)[1]) mainland.reverse();
  while (pending.length) {
    const i = pending.findIndex((points) => distance(mainland.at(-1), points[0]) < 0.02 || distance(mainland.at(-1), points.at(-1)) < 0.02);
    if (i === -1) throw new Error("Regional mainland coastline must form one connected chain");
    const points = pending.splice(i, 1)[0];
    if (distance(mainland.at(-1), points[0]) >= 0.02) points.reverse();
    mainland.push(...points.slice(1));
  }
  const extended = [[mainland[0][0], limits.minZ], ...mainland, [mainland.at(-1)[0], limits.maxZ]];
  const segments = [extended, ...islands].flatMap((ring) => ring.slice(1).map((b, i) => [ring[i], b])).filter(([a, b]) => Math.abs(a[1] - b[1]) > 1e-8);
  const breaks = [...new Set([limits.minZ, limits.maxZ, ...segments.flatMap(([a, b]) => [a[1], b[1]])])].sort((a, b) => a - b);
  const at = ([a, b], z) => a[0] + (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]);
  const strips = breaks.slice(1).map((maxZ, i) => {
    const minZ = breaks[i], middle = (minZ + maxZ) / 2;
    const boundaries = segments.filter(([a, b]) => middle > Math.min(a[1], b[1]) && middle < Math.max(a[1], b[1])).sort((a, b) => at(a, middle) - at(b, middle));
    if (boundaries.length % 2 !== 1) throw new Error(`Invalid coast parity at ${middle}: ${boundaries.length}`);
    return { minZ, maxZ, boundaries };
  });
  const allX = segments.flatMap(([a, b]) => [a[0], b[0]]), western = Math.min(...allX), eastern = Math.max(...allX);
  const stripAt = (z) => strips[gridIndex(breaks, z)];
  const coastX = (z) => at(stripAt(z).boundaries[0], Math.max(breaks[0], Math.min(breaks.at(-1), z)));
  const isLand = ([x, z]) => stripAt(z).boundaries.filter((s) => at(s, z) <= x).length % 2 === 1;
  function clipLand(ring) {
    const xs = ring.map((p) => p[0]), zs = ring.map((p) => p[1]), minX = Math.min(...xs), maxX = Math.max(...xs), minZ = Math.min(...zs), maxZ = Math.max(...zs);
    if (minX >= eastern) return [ring];
    if (maxX < western) return [];
    const pieces = [];
    for (let i = gridIndex(breaks, minZ); i <= gridIndex(breaks, maxZ); i++) {
      const strip = strips[i], band = clipRing(ring, { minX: minX - 1, maxX: maxX + 1, minZ: strip.minZ, maxZ: strip.maxZ });
      if (band.length < 3) continue;
      for (let j = 0; j < strip.boundaries.length; j += 2) {
        let polygon = band;
        for (const [boundary, sign] of [[strip.boundaries[j], 1], [strip.boundaries[j + 1], -1]]) {
          if (!boundary) continue;
          const output = [];
          for (let k = 0; k < polygon.length; k++) {
            const a = polygon[k], b = polygon[(k + 1) % polygon.length], av = sign * (a[0] - at(boundary, a[1])), bv = sign * (b[0] - at(boundary, b[1])), ain = av >= -1e-8, bin = bv >= -1e-8;
            if (ain) output.push(a);
            if (ain !== bin) { const t = av / (av - bv); output.push(a.map((v, axis) => v + (b[axis] - v) * t)); }
          }
          polygon = output;
        }
        if (polygon.length >= 3) pieces.push(polygon);
      }
    }
    return pieces;
  }
  return { mainland, islands, coastX, isLand, clipLand };
}
// Split a triangle at the original model's rectangle. Outside pieces are kept;
// the exact inner rectangle is removed even from very large surface triangles.
function withoutOld(triangle) {
  if (triangle.every((p) => p[0] <= OLD.minX) || triangle.every((p) => p[0] >= OLD.maxX) || triangle.every((p) => p[2] <= OLD.minZ) || triangle.every((p) => p[2] >= OLD.maxZ)) return [triangle];
  let remaining = triangle; const pieces = [];
  for (const [axis, limit, sign] of [[0, OLD.minX, 1], [0, OLD.maxX, -1], [2, OLD.minZ, 1], [2, OLD.maxZ, -1]]) {
    if (!remaining.length) break;
    const inner = [], outer = [];
    for (let i = 0; i < remaining.length; i++) {
      const a = remaining[i], b = remaining[(i + 1) % remaining.length], ain = sign * (a[axis] - limit) >= 0, bin = sign * (b[axis] - limit) >= 0;
      (ain ? inner : outer).push(a);
      if (ain !== bin) { const t = (limit - a[axis]) / (b[axis] - a[axis]); const p = a.map((n, k) => n + (b[k] - n) * t); inner.push(p); outer.push(p); }
    }
    if (outer.length >= 3) pieces.push(outer);
    remaining = inner;
  }
  return pieces;
}
export function createGeometryKit(elevation, limits, terrainGrid = null, surfaceElevation = null, landClip = null) {
  const batches = new Map();
  const surfaceY = (p, lift, batch, color) => surfaceElevation ? surfaceElevation(...p, lift, batch, color) : elevation(...p) + (typeof lift === "function" ? lift(...p) : lift);
  function surfaceTriangle(a, b, c, lift, fixedY, vertices, batch, color, alreadyClipped = false) {
    if (landClip && batch === "Mapped landcover" && !alreadyClipped) {
      for (const polygon of landClip([a, b, c])) for (let i = 1; i + 1 < polygon.length; i++) surfaceTriangle(polygon[0], polygon[i], polygon[i + 1], lift, fixedY, vertices, batch, color, true);
      return;
    }
    if (!terrainGrid || fixedY !== null) {
      for (const p of [a, b, c]) vertices.push(p[0], fixedY ?? surfaceY(p, lift, batch, color), p[1]);
      return;
    }
    const { xs: gridX, zs: gridZ } = terrainGrid;
    const triangle = [a, b, c], xs = triangle.map((p) => p[0]), zs = triangle.map((p) => p[1]);
    for (let ix = gridIndex(gridX, Math.min(...xs)); ix <= gridIndex(gridX, Math.max(...xs)); ix++) {
      const x = gridX[ix], x2 = gridX[ix + 1], strip = clipRing(triangle, { minX: x, maxX: x2, minZ: Math.min(...zs) - 1, maxZ: Math.max(...zs) + 1 });
      if (strip.length < 3) continue;
      const stripZ = strip.map((p) => p[1]);
      for (let iz = gridIndex(gridZ, Math.min(...stripZ)); iz <= gridIndex(gridZ, Math.max(...stripZ)); iz++) {
        const z = gridZ[iz], z2 = gridZ[iz + 1], cell = clipRing(strip, { minX: x, maxX: x2, minZ: z, maxZ: z2 });
        if (cell.length < 3) continue;
        // Both halves use the ground grid's (x + step,z) -> (x,z + step)
        // diagonal. Every final triangle therefore shares its exact plane.
        for (const sign of [-1, 1]) {
          const polygon = [];
          for (let i = 0; i < cell.length; i++) {
            const p = cell[i], q = cell[(i + 1) % cell.length], pv = (p[0] - x) / (x2 - x) + (p[1] - z) / (z2 - z) - 1, qv = (q[0] - x) / (x2 - x) + (q[1] - z) / (z2 - z) - 1;
            const pin = sign * pv >= 0, qin = sign * qv >= 0;
            if (pin) polygon.push(p);
            if (pin !== qin) { const t = pv / (pv - qv); polygon.push(p.map((n, k) => n + (q[k] - n) * t)); }
          }
          for (let i = 1; i + 1 < polygon.length; i++) for (const p of [polygon[0], polygon[i], polygon[i + 1]]) vertices.push(p[0], surfaceY(p, lift, batch, color), p[1]);
        }
      }
    }
  }
  function add(geometry, color, batch = "Regional landscape") {
    const original = geometry.index ? geometry.toNonIndexed() : geometry;
    const position = original.getAttribute("position"); const vertices = [];
    for (let i = 0; i < position.count; i += 3) {
      const triangle = [0, 1, 2].map((j) => [position.getX(i + j), position.getY(i + j), position.getZ(i + j)]);
      for (const polygon of withoutOld(triangle)) for (let k = 1; k + 1 < polygon.length; k++) {
        const [a, b, c] = [polygon[0], polygon[k], polygon[k + 1]], u = b.map((v, n) => v - a[n]), v = c.map((n, j) => n - a[j]);
        const area = Math.hypot(u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]);
        if (area > 0.00001) vertices.push(...a, ...b, ...c);
      }
    }
    geometry.dispose(); if (original !== geometry) original.dispose();
    if (!vertices.length) return;
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3)); g.computeVertexNormals();
    const c = new THREE.Color(color), colors = new Float32Array(vertices.length);
    for (let i = 0; i < colors.length; i += 3) { colors[i] = c.r; colors[i + 1] = c.g; colors[i + 2] = c.b; }
    g.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    if (!batches.has(batch)) batches.set(batch, []);
    batches.get(batch).push(g);
  }
  function flat(ring, color, lift = 0.15, batch, holes = [], fixedY = null) {
    ring = clipRing(ring, limits); if (ring.length < 3) return;
    const shape = new THREE.Shape(ring.map(([x, z]) => new THREE.Vector2(x, -z)));
    for (const hole of holes) if (hole.length >= 3) shape.holes.push(new THREE.Path(hole.map(([x, z]) => new THREE.Vector2(x, -z))));
    const geometry = new THREE.ShapeGeometry(shape); geometry.rotateX(-Math.PI / 2);
    const triangles = geometry.toNonIndexed(), positions = triangles.getAttribute("position"), vertices = [];
    for (let i = 0; i < positions.count; i += 3) surfaceTriangle(...[0, 1, 2].map((j) => [positions.getX(i + j), positions.getZ(i + j)]), lift, fixedY, vertices, batch, color);
    geometry.dispose(); triangles.dispose();
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3)); add(g, color, batch);
  }
  function ribbon(points, width, color, lift = 0.5, batch = "Regional roads", fixedY = null) {
    const vertices = [];
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1], b = points[i], length = distance(a, b); if (length < 0.01) continue;
      const steps = 1;
      for (let j = 0; j < steps; j++) {
        const first = a.map((n, k) => n + (b[k] - n) * j / steps), last = a.map((n, k) => n + (b[k] - n) * (j + 1) / steps);
        const ox = -(b[1] - a[1]) / length * width / 2, oz = (b[0] - a[0]) / length * width / 2;
        const ring = clipRing([[first[0] + ox, first[1] + oz], [first[0] - ox, first[1] - oz], [last[0] - ox, last[1] - oz], [last[0] + ox, last[1] + oz]], limits);
        for (let k = 1; k + 1 < ring.length; k++) surfaceTriangle(ring[0], ring[k], ring[k + 1], lift, fixedY, vertices, batch, color);
      }
    }
    if (vertices.length) { const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3)); add(g, color, batch); }
  }
  function rock(x, y, z, rx, ry, rz, color, batch, rotation = 0) {
    const geometry = new THREE.DodecahedronGeometry(1, 0); geometry.scale(rx, ry, rz); geometry.rotateY(rotation); geometry.translate(x, y, z); add(geometry, color, batch);
  }
  function finish() {
    const scene = new THREE.Group(); scene.name = "Northern San Diego region";
    for (const [name, parts] of batches) {
      const geometry = mergeGeometries(parts); parts.forEach((g) => g.dispose());
      if (!geometry || !geometry.getAttribute("position").array.every(Number.isFinite)) throw new Error(`Invalid regional geometry: ${name}`);
      const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.96, side: THREE.DoubleSide });
      const mesh = new THREE.Mesh(geometry, material); mesh.name = name; mesh.receiveShadow = true; scene.add(mesh);
    }
    return scene;
  }
  return { add, flat, ribbon, rock, finish };
}
