/** Shared deterministic geometry checks for the separate San Diego spawn generators. */
import fs from "node:fs/promises";
import crypto from "node:crypto";
import * as THREE from "three";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { MeshoptDecoder } from "meshoptimizer";

export const WALKING = new Set(["footway", "path", "pedestrian", "steps", "cycleway", "bridleway"]);
export const DRIVING = new Set(["residential", "service", "tertiary", "secondary", "primary", "unclassified", "living_street"]);
export const round = (v) => Math.round(v * 1000) / 1000;
export const hash = (v) => crypto.createHash("sha256").update(v).digest("hex");
export function random(seed) { return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; }; }
export function inside(p, ring) {
  let result = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0]) result = !result;
  }
  return result;
}
export function segmentDistance(p, a, b) {
  const dx = b[0] - a[0], dz = b[1] - a[1];
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / (dx * dx + dz * dz || 1)));
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dz);
}
export function ringDistance(p, ring) { return Math.min(...ring.map((a, i) => segmentDistance(p, a, ring[(i + 1) % ring.length]))); }
export function bounds(ring) { return { minX: Math.min(...ring.map(p => p[0])), maxX: Math.max(...ring.map(p => p[0])), minZ: Math.min(...ring.map(p => p[1])), maxZ: Math.max(...ring.map(p => p[1])) }; }
export function circleHits(p, radius, polygon) {
  const b = polygon.bounds;
  if (p[0] + radius < b.minX || p[0] - radius > b.maxX || p[1] + radius < b.minZ || p[1] - radius > b.maxZ) return false;
  return inside(p, polygon.ring) || ringDistance(p, polygon.ring) <= radius;
}
function crosses(a, b, c, d) {
  const side = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  return side(a, b, c) * side(a, b, d) <= 0 && side(c, d, a) * side(c, d, b) <= 0
    && Math.max(a[0], b[0]) >= Math.min(c[0], d[0]) && Math.max(c[0], d[0]) >= Math.min(a[0], b[0])
    && Math.max(a[1], b[1]) >= Math.min(c[1], d[1]) && Math.max(c[1], d[1]) >= Math.min(a[1], b[1]);
}
export function polygonsOverlap(a, b) {
  const aa = bounds(a), bb = bounds(b);
  if (aa.maxX < bb.minX || aa.minX > bb.maxX || aa.maxZ < bb.minZ || aa.minZ > bb.maxZ) return false;
  return a.some(p => inside(p, b)) || b.some(p => inside(p, a)) || a.some((p, i) => b.some((q, j) => crosses(p, a[(i + 1) % a.length], q, b[(j + 1) % b.length])));
}
export function sweptCar(start, end, margin = 0.4) {
  const len = Math.hypot(end[0] - start[0], end[1] - start[1]);
  const u = [(end[0] - start[0]) / len, (end[1] - start[1]) / len], n = [-u[1], u[0]];
  return [[start, -1, -1], [end, 1, -1], [end, 1, 1], [start, -1, 1]].map(([p, longitudinal, lateral]) =>
    [p[0] + longitudinal * (3.2 + margin) * u[0] + lateral * (1.45 + margin) * n[0], p[1] + longitudinal * (3.2 + margin) * u[1] + lateral * (1.45 + margin) * n[1]]);
}
export async function readSpawnContext() {
  const paths = ["source.osm", "layout", "manifest"];
  const raw = await Promise.all(paths.map(p => fs.readFile(`public/data/san-diego/${p}.json`, "utf8")));
  const [source, layout, manifest] = raw.map(JSON.parse);
  await MeshoptDecoder.ready;
  const glb = await fs.readFile(`public${manifest.modelUrl}`);
  if (hash(glb) !== manifest.contentHash) throw new Error("Scene model does not match manifest hash");
  const model = await new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ "meshopt.decoder": MeshoptDecoder }).readBinary(glb);
  const groundMeshes = [];
  const material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
  for (const node of model.getRoot().listNodes()) {
    if (!node.getMesh()) continue;
    for (const primitive of node.getMesh().listPrimitives()) {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.BufferAttribute(primitive.getAttribute("POSITION").getArray(), 3));
      if (primitive.getIndices()) geometry.setIndex(new THREE.BufferAttribute(primitive.getIndices().getArray(), 1));
      const mesh = new THREE.Mesh(geometry, material);
      mesh.matrixWorld.fromArray(node.getWorldMatrix());
      groundMeshes.push(mesh);
    }
  }
  const ray = new THREE.Raycaster();
  const groundHeight = p => {
    ray.set(new THREE.Vector3(p[0], 30, p[1]), new THREE.Vector3(0, -1, 0));
    const hit = ray.intersectObjects(groundMeshes, false)[0];
    if (!hit || hit.point.y > 0.8) throw new Error(`No safe low ground at ${p}`);
    return round(hit.point.y);
  };
  const origin = manifest.projection.originLongitudeLatitude;
  // Match the scene generator's documented origin/projection exactly.
  const lon = origin?.[0] ?? -117.1518, lat = origin?.[1] ?? 32.9606;
  const project = p => [(p.lon - lon) * 111320 * Math.cos(lat * Math.PI / 180), -(p.lat - lat) * 111320];
  const names = [["westview-high-school", "Westview High School", 60, 16], ["mesa-verde-middle-school", "Mesa Verde Middle School", 45, 12], ["deer-canyon-elementary-school", "Deer Canyon Elementary School", 40, 12]];
  const zones = names.map(([id, name, people, cars]) => { const f = source.elements.find(f => f.tags?.amenity === "school" && f.tags.name === name); if (!f) throw new Error(`Missing campus ${name}`); const ring = f.geometry.map(project); return { id, name, people, cars, ring, bounds: bounds(ring), sourceId: `${f.type}/${f.id}` }; });
  const plaza = source.elements.find(f => f.type === "way" && f.id === 61862581);
  if (!plaza) throw new Error("Missing mapped Torrey Highlands Plaza parcel");
  const plazaRing = plaza.geometry.map(project);
  zones.push({ id: "torrey-highlands-plaza", people: 15, cars: 6, ring: plazaRing, bounds: bounds(plazaRing), sourceId: "way/61862581" });
  const polygons = layout.buildings.map(b => ({ ...b, bounds: bounds(b.ring) }));
  const details = (layout.schoolDetails ?? []).flatMap(s => [...s.surfaces.filter(s => s.kind !== "path").map(s => s.footprint), ...s.structures.map(s => s.footprint), ...s.buildings.flatMap(b => b.canopies.map(c => c.footprint))]);
  const exclusions = [...layout.treeExclusions.map(p => p.ring), ...details].map(ring => ({ ring, bounds: bounds(ring) }));
  const bridgeEnds = layout.roads.filter(r => r.bridge).flatMap(r => [r.points[0], r.points.at(-1)]);
  const drivable = layout.roads.filter(r => DRIVING.has(r.kind) && !r.bridge && r.layer === 0 && !r.points.some(p => bridgeEnds.some(b => Math.hypot(p[0] - b[0], p[1] - b[1]) < 0.11)));
  const segments = drivable.flatMap(road => road.points.slice(1).map((b, i) => ({ road, a: road.points[i], b })));
  return { source, layout, manifest, zones, polygons, exclusions, drivable, segments, groundHeight,
    provenance: { sourceHash: hash(raw[0]), layoutHash: hash(raw[1]), modelHash: manifest.contentHash, seed: "San Diego population v1", projection: "meters; east +X, north -Z", policy: "Same NYC models; school concentration; sparse neighborhoods; no taxis; no bridge routes" } };
}
export function inBounds(p, radius, b) { return p[0] - radius > b.minX && p[0] + radius < b.maxX && p[1] - radius > b.minZ && p[1] + radius < b.maxZ; }
export async function writeLayout(path, name, data, provenance, distribution) {
  const payload = { provenance, distribution, count: data.length, [name]: data };
  const exportName = name === "pedestrians" ? "SAN_DIEGO_PEOPLE" : "SAN_DIEGO_CARS";
  await fs.writeFile(path, `// Generated by scripts/map-data/build-san-diego-${name === "pedestrians" ? "people" : "car"}-spawns.mjs. Do not edit.\nexport const ${exportName} = ${JSON.stringify(payload)} as const;\n`);
  console.log(JSON.stringify({ output: path, count: data.length, distribution, contentHash: hash(JSON.stringify(payload)), provenance }));
}
