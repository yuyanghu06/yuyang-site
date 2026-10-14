/** Reference-informed Torrey Pines road profiles on unchanged OSM centerlines. */
import { point, distance, segmentDistance } from "./san-diego-region-geometry.mjs";

const smooth = (v) => { const t = Math.max(0, Math.min(1, v)); return t * t * (3 - 2 * t); };
const key = (p) => p.map((v) => v.toFixed(5)).join(",");
const roadBounds = { minX: -10650, maxX: -8250, minZ: 2250, maxZ: 6800 };
const inBounds = ([x, z]) => x >= roadBounds.minX && x <= roadBounds.maxX && z >= roadBounds.minZ && z <= roadBounds.maxZ;
export const torreyRoadWidth = (feature, fallback) => {
  const t = feature.tags, width = Number.parseFloat(t.width), lanes = Number.parseFloat(t.lanes);
  if (width > 0) return Math.min(24, width);
  if (["path", "footway", "steps", "pedestrian"].includes(t.highway)) return t.highway === "steps" ? 1.5 : 1.8;
  if (["track", "cycleway"].includes(t.highway)) return 2.6;
  if (t.name === "North Torrey Pines Road") return Math.max(3.6, (lanes || 2) * 3.05 + 0.4);
  if (t.name === "Torrey Pines Park Road") return t.oneway === "yes" ? 3.6 : t.highway === "service" ? 4.6 : 5.8;
  if (t.highway === "service") return 4.2;
  return lanes ? Math.max(4, lanes * 2.9) : fallback;
};
export function createTorreyRoadProfiles(ways) {
  const named = ways.filter((f) => ["North Torrey Pines Road", "Torrey Pines Park Road"].includes(f.tags.name) && !["footway", "cycleway", "path"].includes(f.tags.highway));
  const mainHeight = (z) => 8 + 25 * (1 - smooth((z - 2250) / 500)) + 92 * smooth((z - 3450) / 2000) - 55 * smooth((z - 5500) / 1100);
  const profilePoints = (feature) => {
    const raw = feature.geometry.map(point), points = [raw[0]];
    for (let i = 1; i < raw.length; i++) {
      const a = raw[i - 1], b = raw[i], steps = Math.ceil(distance(a, b) / 8);
      for (let j = 1; j <= steps; j++) points.push(a.map((v, axis) => v + (b[axis] - v) * j / steps));
    }
    return points;
  };
  const park = named.filter((f) => f.tags.name === "Torrey Pines Park Road"), nodes = new Map();
  for (const way of park) {
    const points = profilePoints(way);
    for (let i = 0; i < points.length; i++) {
      const id = key(points[i]); if (!nodes.has(id)) nodes.set(id, { point: points[i], edges: new Map() });
      if (i) { const previous = key(points[i - 1]), length = distance(points[i], points[i - 1]); nodes.get(id).edges.set(previous, length); nodes.get(previous).edges.set(id, length); }
    }
  }
  const ends = [...nodes].filter(([, n]) => n.edges.size === 1).sort((a, b) => a[1].point[1] - b[1].point[1]);
  if (ends.length !== 2) throw new Error("Torrey Pines Park Road must retain its two connected source endpoints");
  function distances(start) {
    const result = new Map([[start, 0]]), pending = new Set(nodes.keys());
    while (pending.size) {
      let next = null, shortest = Infinity;
      for (const id of pending) if ((result.get(id) ?? Infinity) < shortest) { shortest = result.get(id); next = id; }
      if (next === null) throw new Error("Disconnected source Park Road profile");
      pending.delete(next);
      for (const [id, length] of nodes.get(next).edges) if (shortest + length < (result.get(id) ?? Infinity)) result.set(id, shortest + length);
    }
    return result;
  }
  const north = distances(ends[0][0]), south = distances(ends[1][0]);
  const parkHeights = new Map([...nodes].map(([id]) => [id, Math.min(110, mainHeight(ends[0][1].point[1]) + north.get(id) * 0.078, mainHeight(ends[1][1].point[1]) + south.get(id) * 0.065)]));
  const mainSegments = named.filter((f) => f.tags.name === "North Torrey Pines Road").flatMap((f) => { const p = f.geometry.map(point); return p.slice(1).map((b, i) => [p[i], b]); });
  for (const [id, node] of nodes) {
    let closest = null;
    for (const [a, b] of mainSegments) {
      const dx = b[0] - a[0], dz = b[1] - a[1], t = Math.max(0, Math.min(1, ((node.point[0] - a[0]) * dx + (node.point[1] - a[1]) * dz) / (dx * dx + dz * dz)));
      const p = [a[0] + dx * t, a[1] + dz * t], d = distance(p, node.point);
      if (!closest || d < closest.distance) closest = { distance: d, point: p };
    }
    // The disused southern reserve service road hugs the main carriageway;
    // those adjacent pavements cannot carry independent cliff-height profiles.
    if (closest.distance < 80) parkHeights.set(id, Math.min(parkHeights.get(id), mainHeight(closest.point[1]) + Math.max(0, closest.distance - 5) * 0.025));
  }
  const constraints = [...nodes].flatMap(([a, node]) => [...node.edges].map(([b, length]) => [a, b, length * 0.078]));
  const entries = [...nodes];
  for (let i = 0; i < entries.length; i++) for (let j = i + 1; j < entries.length; j++) {
    const d = distance(entries[i][1].point, entries[j][1].point);
    if (d < 35) constraints.push([entries[i][0], entries[j][0], d * 0.04]);
  }
  for (let pass = 0; pass < nodes.size; pass++) {
    let changed = false;
    for (const [a, b, maximum] of constraints) {
      if (parkHeights.get(a) > parkHeights.get(b) + maximum) { parkHeights.set(a, parkHeights.get(b) + maximum); changed = true; }
      if (parkHeights.get(b) > parkHeights.get(a) + maximum) { parkHeights.set(b, parkHeights.get(a) + maximum); changed = true; }
    }
    if (!changed) break;
  }
  const segments = [], profiles = [];
  for (const feature of named) {
    const raw = feature.geometry.map(point); if (!raw.some(inBounds)) continue;
    const isPark = feature.tags.name === "Torrey Pines Park Road";
    const points = profilePoints(feature).map((p) => [...p, isPark ? parkHeights.get(key(p)) : mainHeight(p[1])]);
    const width = torreyRoadWidth(feature, 7);
    profiles.push({ sourceId: `way/${feature.id}`, name: feature.tags.name, width, bridge: feature.tags.bridge === "yes", sourceNodeKeys: raw.map(key), sourceCenterline: raw, maximumProfileSpacing: 8, points: points.map(([x, z, y]) => [x, y, z]) });
    for (let i = 1; i < points.length; i++) segments.push({ a: points[i - 1], b: points[i], width, park: isPark, sourceId: feature.id });
  }
  const bins = new Map();
  for (const segment of segments) for (let ix = Math.floor((Math.min(segment.a[0], segment.b[0]) - 220) / 130); ix <= Math.floor((Math.max(segment.a[0], segment.b[0]) + 220) / 130); ix++) for (let iz = Math.floor((Math.min(segment.a[1], segment.b[1]) - 220) / 130); iz <= Math.floor((Math.max(segment.a[1], segment.b[1]) + 220) / 130); iz++) {
    const id = `${ix},${iz}`; if (!bins.has(id)) bins.set(id, []); bins.get(id).push(segment);
  }
  function nearest(x, z) {
    let best = null; const families = [null, null];
    for (const segment of bins.get(`${Math.floor(x / 130)},${Math.floor(z / 130)}`) ?? []) {
      const { a, b } = segment, dx = b[0] - a[0], dz = b[1] - a[1], length2 = dx * dx + dz * dz;
      const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / length2));
      const d = Math.hypot(x - a[0] - dx * t, z - a[1] - dz * t);
      const sample = { distance: d, height: a[2] + (b[2] - a[2]) * t, segment };
      if (!best || d < best.distance) best = sample;
      const family = segment.park ? 1 : 0;
      if (!families[family] || d < families[family].distance) families[family] = sample;
    }
    if (best) best.families = families.filter(Boolean);
    return best;
  }
  function grade(x, z, current) {
    if (!inBounds([x, z])) return current;
    const road = nearest(x, z); if (!road) return current;
    const boundary = Math.min(x - roadBounds.minX, roadBounds.maxX - x, z - roadBounds.minZ, roadBounds.maxZ - z);
    const blend = (1 - smooth((road.distance - 18) / 145)) * smooth(boundary / 180);
    // A finite-width kernel also blends overlapping pavement cores. A hard
    // nearest-family choice would turn tiny profile offsets into vertical fins.
    let target = road.height;
    if (road.families.length === 2) {
      const weights = road.families.map((r) => 1 / (r.distance ** 2 + 30 ** 2) ** 2);
      target = road.families.reduce((sum, r, i) => sum + r.height * weights[i], 0) / (weights[0] + weights[1]);
    }
    return current + (target - current) * blend;
  }
  function divisions(x, z) {
    const d = Math.min(...segments.map((s) => segmentDistance([x, z], s.a, s.b)));
    return d < 110 && inBounds([x, z]) ? 16 : d < 200 && inBounds([x, z]) ? 4 : 2;
  }
  return { grade, nearest, divisions, profiles, bounds: roadBounds, parkEndpoints: ends.map(([, n]) => n.point), interpretation: "Illustrative connected profiles on exact source coordinates, not surveyed elevations: low coastal main road with a gradual inland rise; separate moderate Park Road ascent. Shared terrain benches carry the road instead of floating ramps." };
}

/** Small contour benches for the reference's named hiking routes, not all paths. */
export function createTorreyTrailProfiles(ways, baseHeight) {
  const selected = ways.filter((f) => ["Guy Fleming Trail", "Parry Grove Trail", "Beach Trail"].includes(f.tags.name) || f.id === 1165999364);
  const nodes = new Map(), lines = [];
  for (const feature of selected) {
    const raw = feature.geometry.map(point); if (!raw.every(inBounds)) continue;
    const points = [raw[0]];
    for (let i = 1; i < raw.length; i++) {
      const a = raw[i - 1], b = raw[i], pieces = Math.ceil(distance(a, b) / 8);
      for (let j = 1; j <= pieces; j++) points.push(a.map((v, axis) => v + (b[axis] - v) * j / pieces));
    }
    for (const p of points) if (!nodes.has(key(p))) nodes.set(key(p), { point: p, height: baseHeight(...p) });
    lines.push({ feature, points, steps: feature.tags.highway === "steps" });
  }
  const constraints = lines.flatMap(({ points, steps }) => points.slice(1).map((p, i) => [key(points[i]), key(p), distance(points[i], p) * (steps ? 1 : 0.24)]));
  for (let pass = 0; pass < nodes.size; pass++) {
    let changed = false;
    for (const [a, b, maximum] of constraints) {
      const first = nodes.get(a), second = nodes.get(b);
      if (first.height > second.height + maximum) { first.height = second.height + maximum; changed = true; }
      if (second.height > first.height + maximum) { second.height = first.height + maximum; changed = true; }
    }
    if (!changed) break;
  }
  const segments = lines.flatMap(({ points, steps }) => steps ? [] : points.slice(1).map((p, i) => [nodes.get(key(points[i])), nodes.get(key(p))]));
  function nearby(x, z) {
    const matches = [];
    for (const [a, b] of segments) {
      const dx = b.point[0] - a.point[0], dz = b.point[1] - a.point[1], t = Math.max(0, Math.min(1, ((x - a.point[0]) * dx + (z - a.point[1]) * dz) / (dx * dx + dz * dz)));
      const d = Math.hypot(x - a.point[0] - dx * t, z - a.point[1] - dz * t);
      if (d < 80) matches.push({ distance: d, height: a.height + (b.height - a.height) * t, length: Math.hypot(dx, dz) });
    }
    return matches;
  }
  function grade(x, z, current) {
    const matches = nearby(x, z); if (!matches.length) return current;
    const closest = Math.min(...matches.map((p) => p.distance));
    // Smooth averaging across bends avoids a hard nearest-segment seam.
    const weights = matches.map((p) => p.length * (1 - smooth(p.distance / 80)) / (p.distance ** 2 + 20 ** 2) ** 2), total = weights.reduce((sum, v) => sum + v, 0);
    const target = matches.reduce((sum, p, i) => sum + p.height * weights[i], 0) / total;
    return current + (target - current) * (1 - smooth((closest - 24) / 50));
  }
  const profiles = lines.map(({ feature, points, steps }) => ({ sourceId: `way/${feature.id}`, name: feature.tags.name ?? "High Point approach", steps, points: points.map((p) => [p[0], nodes.get(key(p)).height, p[1]]) }));
  return { grade, profiles, divisions: (x, z) => nearby(x, z).length ? 16 : 2 };
}
