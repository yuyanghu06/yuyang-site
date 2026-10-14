/** Generate frozen pedestrian orbits from the final mapped scene, never at browser startup. */
import { readSpawnContext, random, round, inside, ringDistance, circleHits, segmentDistance, inBounds, writeLayout, WALKING } from "./san-diego-spawn-utils.mjs";
const c = await readSpawnContext(), rand = random(326061), walkers = [], distribution = {};
const bodyRadius = 0.8; // Bounds the rotating NYC 1.25 × 0.85 body and 0.58 head.
const asphalt = c.layout.roads.filter(r => !WALKING.has(r.kind)).flatMap(road => road.points.slice(1).map((b, i) => ({ road, a: road.points[i], b })));
const paths = c.layout.roads.filter(r => WALKING.has(r.kind) && !r.bridge && r.layer === 0);
function valid(p, radius, zone) {
  const envelope = radius + bodyRadius + 0.25;
  if (!inBounds(p, envelope, c.manifest.localBounds)) return false;
  if (zone && (!inside(p, zone.ring) || ringDistance(p, zone.ring) <= envelope)) return false;
  if (c.polygons.some(b => circleHits(p, envelope + 0.35, b)) || c.exclusions.some(b => circleHits(p, envelope, b))) return false;
  if (c.layout.trees.some(t => Math.hypot(p[0] - t.x, p[1] - t.z) <= envelope + t.radius + 0.5)) return false;
  if (zone && paths.some(road => road.points.slice(1).some((b, i) => segmentDistance(p, road.points[i], b) <= road.width / 2 + envelope))) return false;
  if (asphalt.some(s => segmentDistance(p, s.a, s.b) <= (s.road.width + (s.road.kind.startsWith("motorway") ? 1.5 : 2)) / 2 + envelope)) return false;
  if (walkers.some(w => Math.hypot(p[0] - w.x, p[1] - w.z) < envelope + w.radius + bodyRadius + 1.5)) return false;
  return true;
}
function add(p, radius, zone, surface) {
  walkers.push({ groundY: c.groundHeight(p), x: round(p[0]), z: round(p[1]), radius: round(radius), heading: round(rand() * Math.PI * 2), phase: round(rand() * Math.PI * 2), speed: round(0.055 + rand() * 0.055), zone, surface });
}
for (const zone of c.zones) {
  const campusBuildings = c.polygons.filter(b => b.landmark === zone.id);
  let attempts = 0, count = 0;
  while (count < zone.people && attempts++ < 30000) {
    const p = [zone.bounds.minX + rand() * (zone.bounds.maxX - zone.bounds.minX), zone.bounds.minZ + rand() * (zone.bounds.maxZ - zone.bounds.minZ)];
    const radius = 1.3 + rand() * 1.5;
    // Students belong near entrances/courtyards, not distant undeveloped campus hills.
    if (!campusBuildings.some(b => ringDistance(p, b.ring) < 32) || !valid(p, radius, zone)) continue;
    add(p, radius, zone.id, "mapped campus/plaza grounds within 32 m of buildings"); count++;
  }
  distribution[zone.id] = count;
  if (count !== zone.people) throw new Error(`Only ${count}/${zone.people} clear pedestrian orbits for ${zone.id}`);
}
// Sparse neighborhood walkers stay on actual mapped walking surfaces. Require
// the entire walking circle to fit the path width; never invent sidewalk lawns.
let attempts = 0, count = 0;
while (count < 36 && attempts++ < 60000) {
  const road = paths[Math.floor(rand() * paths.length)];
  const i = Math.floor(rand() * (road.points.length - 1)), a = road.points[i], b = road.points[i + 1], t = rand();
  const p = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  const radius = Math.min(0.7, road.width / 2 - bodyRadius - 0.35);
  if (radius < 0.2 || c.zones.some(z => inside(p, z.ring)) || !valid(p, radius)) continue;
  if (segmentDistance(p, a, b) > road.width / 2 - radius - bodyRadius - 0.25 || Math.hypot(p[0] - a[0], p[1] - a[1]) < 3 || Math.hypot(p[0] - b[0], p[1] - b[1]) < 3) continue;
  add(p, radius, "neighborhoods", road.sourceId); count++;
}
distribution.neighborhoods = count;
if (count !== 36) throw new Error(`Only ${count}/36 mapped neighborhood pedestrian orbits fit`);
await writeLayout("src/generated/san-diego-people-spawns.ts", "pedestrians", walkers, { ...c.provenance, bodyRadius, clearance: 0.25, groundSupport: "Sampled from final GLB; campus circles exclude raised walking ribbons and full road shoulders; neighborhood orbits fit mapped paths" }, distribution);
