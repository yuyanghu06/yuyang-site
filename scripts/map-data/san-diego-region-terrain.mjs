/** Local, conforming Torrey Pines relief; all other terrain keeps its old grid. */
import { gridIndex } from "./san-diego-region-geometry.mjs";

const smooth = (v) => { const t = Math.max(0, Math.min(1, v)); return t * t * (3 - 2 * t); };
export function torreyRidge(x, z, coastX) {
  const inland = x - coastX(z);
  if (z <= 3150 || z >= 5700 || inland <= 190 || inland >= 1250) return 0;
  const ends = smooth((z - 3150) / 450) * smooth((5700 - z) / 650);
  const crest = 580 + 44 * Math.sin((z - 3300) / 430) + 22 * Math.sin((z - 3410) / 210);
  const westTop = crest - 150, eastTop = crest + 165;
  const crown = (d) => 1 - 0.045 * ((d - crest) / 180) ** 2;
  const cross = inland < westTop ? crown(westTop) * smooth((inland - 190) / (westTop - 190)) : inland <= eastTop ? crown(inland) : crown(eastTop) * (1 - smooth((inland - eastTop) / (1250 - eastTop)));
  // Broad, tapered drainage cuts branch down both faces. Their widths span
  // several local triangles; no sub-cell spikes or stochastic texture noise.
  const ravines = [
    [3500, 3690, 555, 100, 0.32], [4110, 3970, 610, 112, 0.34],
    [4690, 4530, 625, 106, 0.37], [5140, 5320, 575, 123, 0.29],
  ];
  let cut = 0;
  for (const [toe, head, reach, width, depth] of ravines) {
    const t = Math.max(0, Math.min(1, (inland - 190) / (reach - 190)));
    const path = toe + (head - toe) * t + 28 * Math.sin(t * Math.PI);
    const taper = smooth((inland - 190) / 140) * (1 - smooth((inland - reach + 90) / 180));
    cut += depth * Math.exp(-(((z - path) / width) ** 2)) * taper;
    const branch = path + (1 - t) * 205;
    cut += depth * 0.45 * Math.exp(-(((z - branch) / (width * 0.8)) ** 2)) * taper * smooth((inland - 290) / 180);
  }
  for (const [head, toe, width, depth] of [[3740, 3940, 135, 0.2], [4760, 4480, 155, 0.27], [5200, 5480, 145, 0.22]]) {
    const t = Math.max(0, Math.min(1, (inland - 690) / 560));
    cut += depth * Math.exp(-(((z - head - (toe - head) * t) / width) ** 2)) * smooth((inland - 650) / 160) * (1 - smooth((inland - 1100) / 150));
  }
  return Math.max(0, cross * (1 - cut)) * ends;
}

export function barycentric([x, z], [a, b, c]) {
  const denominator = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1]);
  const u = ((b[1] - c[1]) * (x - c[0]) + (c[0] - b[0]) * (z - c[1])) / denominator;
  const v = ((c[1] - a[1]) * (x - c[0]) + (a[0] - c[0]) * (z - c[1])) / denominator;
  return [u, v, 1 - u - v];
}

export function createLocalTerrain(grid, requestedBounds, heightAt, roadDivisions = null) {
  const ix0 = gridIndex(grid.xs, requestedBounds.minX), ix1 = gridIndex(grid.xs, requestedBounds.maxX);
  const iz0 = gridIndex(grid.zs, requestedBounds.minZ), iz1 = gridIndex(grid.zs, requestedBounds.maxZ);
  const core = (ix, iz) => ix >= ix0 && ix <= ix1 && iz >= iz0 && iz <= iz1;
  const cells = new Map(), heights = new Map();
  const height = ([x, z]) => {
    const key = `${x},${z}`;
    if (!heights.has(key)) heights.set(key, heightAt(x, z));
    return heights.get(key);
  };
  // Shared edge midpoints retain straight coarse-cell boundaries. Small,
  // deterministic interior offsets and alternate diagonals avoid long strips.
  const vertex = (ix, iz) => {
    const x0 = Math.floor(ix), z0 = Math.floor(iz), fx = ix - x0, fz = iz - z0;
    const x = grid.xs[x0] + (fx ? (grid.xs[x0 + 1] - grid.xs[x0]) * fx : 0);
    const z = grid.zs[z0] + (fz ? (grid.zs[z0 + 1] - grid.zs[z0]) * fz : 0);
    return [x + (fx ? 7 * Math.sin(ix * 1.71 + iz * 0.89) : 0), z + (fz ? 7 * Math.sin(ix * 0.73 - iz * 1.37) : 0)];
  };
  const levels = new Map();
  for (let iz = iz0 - 1; iz <= iz1 + 1; iz++) for (let ix = ix0 - 1; ix <= ix1 + 1; ix++) {
    if (core(ix, iz)) levels.set(`${ix},${iz}`, roadDivisions?.((grid.xs[ix] + grid.xs[ix + 1]) / 2, (grid.zs[iz] + grid.zs[iz + 1]) / 2) ?? 2);
    else if (core(ix - 1, iz) || core(ix + 1, iz) || core(ix, iz - 1) || core(ix, iz + 1)) levels.set(`${ix},${iz}`, 1);
  }
  const level = (ix, iz) => levels.get(`${ix},${iz}`) ?? 1;
  // Finer road cells subdivide the accepted, slightly irregular half-cell
  // lattice. They retain its shared vertices rather than creating global strips.
  const refinedVertex = (ix, iz) => {
    const x = Math.floor(ix * 2) / 2, z = Math.floor(iz * 2) / 2, u = (ix - x) * 2, v = (iz - z) * 2;
    if (!u && !v) return vertex(ix, iz);
    const a = vertex(x, z), b = vertex(x + 0.5, z), c = vertex(x, z + 0.5), d = vertex(x + 0.5, z + 0.5);
    return a.map((_, k) => a[k] * (1 - u) * (1 - v) + b[k] * u * (1 - v) + c[k] * (1 - u) * v + d[k] * u * v);
  };
  for (const [id, divisions] of levels) {
    const [ix, iz] = id.split(',').map(Number), triangles = [];
    for (let dz = 0; dz < divisions; dz++) for (let dx = 0; dx < divisions; dx++) {
      const x = ix + dx / divisions, z = iz + dz / divisions, step = 1 / divisions;
      const ring = [], corners = [[x, z], [x + step, z], [x + step, z + step], [x, z + step]];
      const neighbors = [dz === 0 ? level(ix, iz - 1) : divisions, dx === divisions - 1 ? level(ix + 1, iz) : divisions, dz === divisions - 1 ? level(ix, iz + 1) : divisions, dx === 0 ? level(ix - 1, iz) : divisions];
      for (let edge = 0; edge < 4; edge++) {
        const a = corners[edge], b = corners[(edge + 1) % 4], pieces = Math.max(1, neighbors[edge] / divisions);
        for (let i = 0; i < pieces; i++) ring.push(refinedVertex(a[0] + (b[0] - a[0]) * i / pieces, a[1] + (b[1] - a[1]) * i / pieces));
      }
      if (ring.length > 4 || divisions === 1) {
        const middle = divisions === 1 && (iz === iz0 - 1 || iz === iz1 + 1) ? [(grid.xs[ix] + grid.xs[ix + 1]) / 2, (grid.zs[iz] + grid.zs[iz + 1]) / 2] : refinedVertex(x + step / 2, z + step / 2);
        for (let i = 0; i < ring.length; i++) triangles.push([ring[i], ring[(i + 1) % ring.length], middle]);
      } else if ((ix + iz + dx + dz) % 2) triangles.push([ring[0], ring[1], ring[2]], [ring[0], ring[2], ring[3]]);
      else triangles.push([ring[0], ring[1], ring[3]], [ring[1], ring[2], ring[3]]);
    }
    cells.set(id, triangles);
  }
  const trianglesAt = (ix, iz) => cells.get(`${ix},${iz}`) ?? null;
  const triangleBins = new Map();
  for (const triangles of cells.values()) for (const triangle of triangles) {
    const xs = triangle.map((p) => p[0]), zs = triangle.map((p) => p[1]);
    triangle.bounds = { minX: Math.min(...xs), maxX: Math.max(...xs), minZ: Math.min(...zs), maxZ: Math.max(...zs) };
    for (let ix = Math.floor(triangle.bounds.minX / 32); ix <= Math.floor(triangle.bounds.maxX / 32); ix++) for (let iz = Math.floor(triangle.bounds.minZ / 32); iz <= Math.floor(triangle.bounds.maxZ / 32); iz++) {
      const id = `${ix},${iz}`; if (!triangleBins.has(id)) triangleBins.set(id, []); triangleBins.get(id).push(triangle);
    }
  }
  function elevation(x, z) {
    if (!trianglesAt(gridIndex(grid.xs, x), gridIndex(grid.zs, z))) return null;
    const triangles = triangleBins.get(`${Math.floor(x / 32)},${Math.floor(z / 32)}`) ?? [];
    for (const triangle of triangles) {
      const weights = barycentric([x, z], triangle);
      if (weights.every((w) => w >= -1e-9)) return weights.reduce((sum, w, i) => sum + w * height(triangle[i]), 0);
    }
    throw new Error(`Local terrain has a hole at ${x},${z}`);
  }
  const bounds = { minX: grid.xs[ix0 - 1], maxX: grid.xs[ix1 + 2], minZ: grid.zs[iz0 - 1], maxZ: grid.zs[iz1 + 2] };
  const refinement = { bounds, coreBounds: { minX: grid.xs[ix0], maxX: grid.xs[ix1 + 1], minZ: grid.zs[iz0], maxZ: grid.zs[iz1 + 1] }, nominalSpacingMeters: 65, roadSpacingMeters: roadDivisions ? 8.125 : undefined, roadCellCount: [...levels.values()].filter((n) => n > 2).length, transition: "One coarse cell ring, with shared edge midpoints and unsplit outer edges; no T-junctions or global density strips.", cells: [...cells].map(([key, triangles]) => ({ indices: key.split(",").map(Number), triangles: triangles.map((triangle) => triangle.map((p) => [p[0], height(p), p[1]])) })) };
  Object.defineProperty(grid, "cellTriangles", { value: trianglesAt });
  grid.refinement = refinement;
  return { elevation, trianglesAt, refinement };
}
