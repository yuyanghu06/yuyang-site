import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import * as THREE from "three";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { dedup, meshopt, prune, weld } from "@gltf-transform/functions";
import { MeshoptEncoder } from "meshoptimizer";

const ROOT = process.cwd();
const SOURCE = path.join(ROOT, "public/data/washington-square-citygml.json");
const OUTPUT = path.join(ROOT, "public/models/washington-city");
const TILE_SIZE = 192;
const OMITTED_BINS = new Set(["1088400", "1008626", "1008875", "1008627", "1077346", "1078952", "1087304", "1017906"]);
const DETAIL_BINS = new Set(["1008875", "1008627", "1008629", "1077346", "1078952", "1087304", "1017906"]);

const PALETTE = [0xb9a98d, 0xc49b72, 0xa96f61, 0xb77b5f, 0x788878, 0x858983, 0xd2c3a6, 0x71675c];
const LANDMARKS = {
  "1008847": { wall: 0xa3a39b, roof: 0xc2bdb2, ground: 0xb0aea5 },
  "1008820": { wall: 0xd1cec5, roof: 0xe1dbcf, ground: 0xd7d3ca },
  "1008875": { wall: 0x956553, roof: 0xb8aa9b, ground: 0x806056 },
  "1008627": { wall: 0x6f5d54, roof: 0x8d8176, ground: 0x63534c },
  "1008629": { wall: 0x8f5e50, roof: 0xaaa094, ground: 0x785047 },
  "1077346": { wall: 0x8f5e50, roof: 0xaaa094, ground: 0x785047 },
  "1078952": { wall: 0xa9aaa5, roof: 0xc4c0b6, ground: 0x96958f },
  "1087304": { wall: 0xc49b72, roof: 0x94a184, ground: 0xa98568 },
  "1017906": { wall: 0xc7aa83, roof: 0x9b9384, ground: 0xa18d72 },
};

class NodeFileReader {
  result = null;
  onloadend = null;
  onerror = null;
  async readAsArrayBuffer(blob) {
    try { this.result = await blob.arrayBuffer(); this.onloadend?.(); } catch (error) { this.onerror?.(error); }
  }
  async readAsDataURL(blob) {
    try {
      const buffer = Buffer.from(await blob.arrayBuffer());
      this.result = `data:${blob.type};base64,${buffer.toString("base64")}`;
      this.onloadend?.();
    } catch (error) { this.onerror?.(error); }
  }
}
globalThis.FileReader ??= NodeFileReader;

function colorFor(id, kind) {
  const explicit = LANDMARKS[id]?.[kind];
  if (explicit !== undefined) return new THREE.Color(explicit);
  let hash = 2166136261;
  for (const character of id) { hash ^= character.charCodeAt(0); hash = Math.imul(hash, 16777619); }
  const color = new THREE.Color(PALETTE[Math.abs(hash) % PALETTE.length]);
  if (kind === "roof") color.offsetHSL(0, -0.05, 0.1);
  if (kind === "ground") color.offsetHSL(0, -0.08, 0.025);
  return color;
}

function normalFor(ring) {
  const normal = new THREE.Vector3();
  for (let index = 0; index < ring.length; index += 1) {
    const current = ring[index]; const next = ring[(index + 1) % ring.length];
    normal.x += (current[1] - next[1]) * (current[2] + next[2]);
    normal.y += (current[2] - next[2]) * (current[0] + next[0]);
    normal.z += (current[0] - next[0]) * (current[1] + next[1]);
  }
  return normal.normalize();
}

function projected(ring, normal) {
  const axis = normal.clone().set(Math.abs(normal.x), Math.abs(normal.y), Math.abs(normal.z));
  if (axis.x >= axis.y && axis.x >= axis.z) return ring.map(([, y, z]) => new THREE.Vector2(z, y));
  if (axis.y >= axis.z) return ring.map(([x, , z]) => new THREE.Vector2(x, z));
  return ring.map(([x, y]) => new THREE.Vector2(x, y));
}

function geometryFor(surfaces) {
  const positions = []; const colors = []; const indices = [];
  for (const surface of surfaces) {
    if (surface.ring.length < 3) continue;
    const normal = normalFor(surface.ring);
    const rings = [surface.ring, ...surface.holes];
    const offset = positions.length / 3;
    for (const ring of rings) for (const point of ring) {
      positions.push(...point); colors.push(surface.color.r, surface.color.g, surface.color.b);
    }
    const faces = THREE.ShapeUtils.triangulateShape(projected(surface.ring, normal), surface.holes.map((hole) => projected(hole, normal)));
    for (const face of faces) {
      const a = new THREE.Vector3(...rings.flat()[face[0]]);
      const b = new THREE.Vector3(...rings.flat()[face[1]]);
      const c = new THREE.Vector3(...rings.flat()[face[2]]);
      if (b.clone().sub(a).cross(c.clone().sub(a)).dot(normal) < 0) indices.push(offset + face[0], offset + face[2], offset + face[1]);
      else indices.push(offset + face[0], offset + face[1], offset + face[2]);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices); geometry.computeVertexNormals(); geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  return geometry;
}

const sourceText = await fs.readFile(SOURCE, "utf8");
const generatorText = await fs.readFile(new URL(import.meta.url), "utf8");
const sourceVersion = createHash("sha256").update(sourceText).update(generatorText).digest("hex").slice(0, 12);
const source = JSON.parse(sourceText);
const tiles = new Map(); const footprints = []; const details = {};
for (const building of source.buildings) {
  const id = building.bin ?? building.doittId ?? building.sourceId ?? "building";
  const grounds = building.surfaces.filter((surface) => surface.kind === "ground");
  for (const surface of grounds) footprints.push(surface.ring.map(([x, , z]) => [x, z]));
  if (DETAIL_BINS.has(id)) details[id] = building.surfaces;
  if (OMITTED_BINS.has(id)) continue;
  const points = building.surfaces.flatMap((surface) => surface.ring);
  if (!points.length) continue;
  const centerX = points.reduce((sum, point) => sum + point[0], 0) / points.length;
  const centerZ = points.reduce((sum, point) => sum + point[2], 0) / points.length;
  const tileX = Math.floor(centerX / TILE_SIZE); const tileZ = Math.floor(centerZ / TILE_SIZE);
  const key = `${tileX}_${tileZ}`;
  const tile = tiles.get(key) ?? { tileX, tileZ, ground: [], wall: [], roof: [] };
  for (const surface of building.surfaces) tile[surface.kind].push({ ...surface, color: colorFor(id, surface.kind) });
  tiles.set(key, tile);
}

await fs.rm(OUTPUT, { recursive: true, force: true });
await fs.mkdir(OUTPUT, { recursive: true });
const exporter = new GLTFExporter(); const manifestTiles = [];
await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ "meshopt.encoder": MeshoptEncoder });
for (const [key, tile] of [...tiles].sort(([a], [b]) => a.localeCompare(b))) {
  const group = new THREE.Group(); group.name = `City tile ${key}`;
  for (const kind of ["ground", "wall", "roof"]) {
    if (!tile[kind].length) continue;
    const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, side: THREE.FrontSide });
    material.name = `city-${kind}`;
    const mesh = new THREE.Mesh(geometryFor(tile[kind]), material); mesh.name = kind; group.add(mesh);
  }
  const output = await exporter.parseAsync(group, { binary: true, onlyVisible: true });
  const file = `tile-${key}.glb`; const outputPath = path.join(OUTPUT, file);
  await fs.writeFile(outputPath, Buffer.from(output));
  const document = await io.read(outputPath);
  await document.transform(dedup(), weld(), prune(), meshopt({ encoder: MeshoptEncoder, level: "medium" }));
  await io.write(outputPath, document);
  manifestTiles.push({ file, x: (tile.tileX + 0.5) * TILE_SIZE, z: (tile.tileZ + 0.5) * TILE_SIZE });
  group.traverse((object) => { if (object.isMesh) { object.geometry.dispose(); object.material.dispose(); } });
}
await fs.writeFile(path.join(OUTPUT, "manifest.json"), JSON.stringify({ version: sourceVersion, tileSize: TILE_SIZE, buildingCount: source.buildings.length, tiles: manifestTiles }));
await fs.writeFile(path.join(OUTPUT, "runtime.json"), JSON.stringify({ footprints, details }));
console.log(`Built ${manifestTiles.length} spatial GLB tiles from ${source.buildings.length} buildings.`);
