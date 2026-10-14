/** Dedicated San Diego car spawn script: ordinary cars only, independent of NYC taxis and people. */
import { readSpawnContext, random, round, inside, ringDistance, sweptCar, polygonsOverlap, circleHits, bounds, inBounds, writeLayout } from "./san-diego-spawn-utils.mjs";
const c = await readSpawnContext(), rand = random(326062), cars = [], distribution = {};
const schoolRadius = 100; // Campus entrances and their immediately adjoining streets.
const candidates = [];
for (const s of c.segments) {
  const length = Math.hypot(s.b[0] - s.a[0], s.b[1] - s.a[1]);
  if (length < 25 || s.road.width < 7) continue;
  const u = [(s.b[0] - s.a[0]) / length, (s.b[1] - s.a[1]) / length];
  // 14 m travel windows plus chassis endpoint margins, separated by 6 m.
  for (let offset = 5; offset + 14 + 5 < length; offset += 28) {
    const start = [round(s.a[0] + u[0] * offset), round(s.a[1] + u[1] * offset)];
    const end = [round(start[0] + u[0] * 14), round(start[1] + u[1] * 14)];
    const hull = sweptCar(start, end), center = [(start[0] + end[0]) / 2, (start[1] + end[1]) / 2];
    if (hull.some(p => !inBounds(p, 0, c.manifest.localBounds))) continue;
    if (c.polygons.some(b => polygonsOverlap(hull, b.ring)) || c.exclusions.some(b => polygonsOverlap(hull, b.ring))) continue;
    const hullPolygon = { ring: hull, bounds: bounds(hull) };
    if (c.layout.trees.some(t => circleHits([t.x, t.z], t.radius + 0.5, hullPolygon))) continue;
    const zone = c.zones.find(z => inside(center, z.ring) || ringDistance(center, z.ring) < schoolRadius)?.id ?? "neighborhoods";
    candidates.push({ start, end, hull, zone, sourceId: s.road.sourceId, width: s.road.width, rank: rand() });
  }
}
candidates.sort((a, b) => a.rank - b.rank);
const accepted = [];
for (const [zone, target] of [...c.zones.map(z => [z.id, z.cars]), ["neighborhoods", 24]]) {
  let count = 0;
  for (const route of candidates.filter(r => r.zone === zone)) {
    if (count >= target) break;
    // Disjoint swept envelopes prevent cars from meeting along their complete
    // ping-pong routes, including the full 6.4 × 2.9 chassis at each endpoint.
    if (accepted.some(r => polygonsOverlap(route.hull, r.hull))) continue;
    accepted.push(route);
    cars.push({ groundY: 0.5, start: route.start, end: route.end, offset: round(rand() * 2), speed: round(0.045 + rand() * 0.04), zone, sourceId: route.sourceId, roadWidth: route.width });
    count++;
  }
  distribution[zone] = count;
  if (count !== target) throw new Error(`Only ${count}/${target} clear car routes for ${zone}`);
}
await writeLayout("src/generated/san-diego-car-spawns.ts", "traffic", cars, { ...c.provenance, schoolRadius, carSize: [6.4, 1.55, 2.9], sweptMargin: 0.4, minimumRoadWidth: 7, groundSupport: "0.5 m flat mapped roads; bridges and complete connected approach ways excluded", palette: ["#45535f", "#f1ede2", "#895b50", "#6f8078", "#747b8d"], taxis: 0 }, distribution);
