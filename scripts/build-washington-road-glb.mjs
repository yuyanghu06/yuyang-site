import fs from "node:fs/promises";
import * as THREE from "three";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { dedup, meshopt, prune, weld } from "@gltf-transform/functions";
import { MeshoptEncoder } from "meshoptimizer";

class NodeFileReader {
  result = null; onloadend = null; onerror = null;
  async readAsArrayBuffer(blob) { try { this.result = await blob.arrayBuffer(); this.onloadend?.(); } catch (error) { this.onerror?.(error); } }
  async readAsDataURL(blob) { try { this.result = `data:${blob.type};base64,${Buffer.from(await blob.arrayBuffer()).toString("base64")}`; this.onloadend?.(); } catch (error) { this.onerror?.(error); } }
}
globalThis.FileReader ??= NodeFileReader;

const source = JSON.parse(await fs.readFile("public/data/washington-square-planimetrics.json", "utf8"));
const positions = []; const indices = [];
for (const roadbed of source.roadbeds) {
  const rings = [roadbed.ring, ...roadbed.holes];
  const offset = positions.length / 3;
  for (const ring of rings) for (const [x, z] of ring) positions.push(x, 0.12, z);
  const contour = roadbed.ring.map(([x, z]) => new THREE.Vector2(x, z));
  const holes = roadbed.holes.map((ring) => ring.map(([x, z]) => new THREE.Vector2(x, z)));
  for (const face of THREE.ShapeUtils.triangulateShape(contour, holes)) indices.push(offset + face[0], offset + face[2], offset + face[1]);
}
const geometry = new THREE.BufferGeometry();
geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
geometry.setIndex(indices); geometry.computeVertexNormals();
const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: 0x6f6a61, roughness: 1, side: THREE.DoubleSide }));
mesh.name = "Pretriangulated NYC 2022 planimetric roadbeds";
const output = await new GLTFExporter().parseAsync(mesh, { binary: true, onlyVisible: true });
const destination = "public/models/washington-roads.glb";
await fs.writeFile(destination, Buffer.from(output));
await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ "meshopt.encoder": MeshoptEncoder });
const document = await io.read(destination);
await document.transform(dedup(), weld(), prune(), meshopt({ encoder: MeshoptEncoder, level: "medium" }));
await io.write(destination, document);
console.log(`Wrote road GLB with ${source.roadbeds.length} polygons (${Math.round((await fs.stat(destination)).size / 1024)} KiB)`);
