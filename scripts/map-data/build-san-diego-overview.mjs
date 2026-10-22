/** Derive a deterministic, noninteractive overview without rewriting source detail. */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { Document, NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS, EXTMeshoptCompression } from "@gltf-transform/extensions";
import { compactPrimitive, dedup, mergeDocuments, prune, reorder, unpartition, weld } from "@gltf-transform/functions";
import { MeshoptDecoder, MeshoptEncoder, MeshoptSimplifier } from "meshoptimizer";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const modelUrl = "/models/san-diego/overview.glb";
const manifestUrl = "/data/san-diego/overview-manifest.json";
const publicPath = (url) => path.join(root, "public", url);
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const readJSON = async (url) => JSON.parse(await fs.readFile(publicPath(url), "utf8"));
const original = await readJSON("/data/san-diego/manifest.json");
const regional = await readJSON("/data/san-diego/region-manifest.json");
const patch = regional.originalPatchExclusion;
const sources = [
  { group: "overview-region", manifest: regional },
  { group: "overview-original", manifest: original },
];
const sourceNodes = new Map();

function decodedBufferBytes(bytes) {
  const buffer = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const gltf = JSON.parse(buffer.toString("utf8", 20, 20 + buffer.readUInt32LE(12)));
  // Accessor element sizes omit glTF's padded NORMAL/COLOR byte strides.
  // Buffer views measure the actual decoded/upload capacity seen by Three.js.
  return gltf.bufferViews.reduce((sum, view) => sum + view.byteLength, 0);
}

// Error is meshoptimizer's absolute positional metric in meters, not a strict
// Hausdorff bound. Surfaces stay conservative because their elevations differ
// by centimeters near the original-patch seam. Positions are never quantized.
function policy(name) {
  if (name === "Pacific Ocean" || /waterfall/.test(name)) return { kind: "retained", ratio: 1, errorMeters: 0 };
  if (/buildings|School|Plaza/.test(name)) return { kind: "rooftops", ratio: 0.05, errorMeters: 0.5, lockBorder: true };
  if (/trees|Trees/.test(name)) return { kind: "trees", ratio: 0.15, errorMeters: 3 };
  if (name === "Regional landscape") return { kind: "surface", ratio: 0.05, errorMeters: 0.005, lockBorder: true };
  if (name === "terrain") return { kind: "surface", ratio: 0.05, errorMeters: 0.005, lockBorder: true };
  return { kind: "surface", ratio: 0.05, errorMeters: 0.03, lockBorder: /beach|Lagoons/.test(name) };
}

function primitiveStats(primitive) {
  const accessors = new Set([...primitive.listAttributes(), primitive.getIndices()].filter(Boolean));
  return {
    triangles: primitive.getIndices().getCount() / 3,
    vertices: primitive.getAttribute("POSITION").getCount(),
    accessorPayloadBytes: [...accessors].reduce((sum, accessor) => sum + accessor.getArray().byteLength, 0),
    bounds: { min: primitive.getAttribute("POSITION").getMin([]), max: primitive.getAttribute("POSITION").getMax([]) },
  };
}

function documentStats(document) {
  let triangles = 0, vertices = 0, primitives = 0;
  for (const mesh of document.getRoot().listMeshes()) for (const primitive of mesh.listPrimitives()) {
    const stats = primitiveStats(primitive);
    triangles += stats.triangles; vertices += stats.vertices; primitives++;
  }
  return {
    triangles, vertices, primitives,
    accessorPayloadBytes: document.getRoot().listAccessors().reduce((sum, accessor) => sum + accessor.getArray().byteLength, 0),
  };
}

function roofIndices(primitive) {
  const positions = primitive.getAttribute("POSITION").getArray();
  const indices = primitive.getIndices().getArray();
  const retained = [];
  for (let i = 0; i < indices.length; i += 3) {
    const a = indices[i] * 3, b = indices[i + 1] * 3, c = indices[i + 2] * 3;
    const ux = positions[b] - positions[a], uy = positions[b + 1] - positions[a + 1], uz = positions[b + 2] - positions[a + 2];
    const vx = positions[c] - positions[a], vy = positions[c + 1] - positions[a + 1], vz = positions[c + 2] - positions[a + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    // Keep actual roof planes and upward-facing campus grounds. Omit facades,
    // windows and undersides that are subpixel in the authored whole-city view.
    if (ny > Math.hypot(nx, ny, nz) * 0.35) retained.push(indices[i], indices[i + 1], indices[i + 2]);
  }
  return new Uint32Array(retained);
}

function seamLocks(positions, matrix) {
  const locks = new Uint8Array(positions.length / 3);
  for (let i = 0; i < locks.length; i++) {
    const px = positions[i * 3], py = positions[i * 3 + 1], pz = positions[i * 3 + 2];
    const x = matrix[0] * px + matrix[4] * py + matrix[8] * pz + matrix[12];
    const z = matrix[2] * px + matrix[6] * py + matrix[10] * pz + matrix[14];
    const nearX = Math.min(Math.abs(x - patch.min[0]), Math.abs(x - patch.max[0])) <= 1;
    const nearZ = Math.min(Math.abs(z - patch.min[2]), Math.abs(z - patch.max[2])) <= 1;
    if ((nearX && z >= patch.min[2] - 1 && z <= patch.max[2] + 1)
      || (nearZ && x >= patch.min[0] - 1 && x <= patch.max[0] + 1)) locks[i] = 1;
  }
  return locks;
}

function simplifyPrimitive(document, primitive, settings, matrix) {
  let indices = settings.kind === "rooftops" ? roofIndices(primitive) : new Uint32Array(primitive.getIndices().getArray());
  const positions = primitive.getAttribute("POSITION").getArray();
  let measuredErrorMeters = 0;
  if (settings.ratio < 1 && indices.length) {
    const flags = ["ErrorAbsolute", ...(settings.lockBorder ? ["LockBorder"] : [])];
    [indices, measuredErrorMeters] = MeshoptSimplifier.simplifyWithAttributes(
      indices, positions, 3, new Float32Array(positions.length / 3), 1, [0],
      settings.kind === "surface" ? seamLocks(positions, matrix) : null,
      Math.floor(indices.length * settings.ratio / 3) * 3, settings.errorMeters, flags,
    );
  }
  primitive.setIndices(document.createAccessor().setType("SCALAR").setArray(indices));
  compactPrimitive(primitive);
  if (primitive.getAttribute("POSITION").getCount() <= 65535) {
    primitive.getIndices().setArray(new Uint16Array(primitive.getIndices().getArray()));
  }
  return measuredErrorMeters;
}

function validate(document) {
  const groups = document.getRoot().getDefaultScene().listChildren().map((node) => node.getName());
  for (const source of sources) if (!groups.includes(source.group)) throw new Error(`Missing ${source.group}`);
  for (const node of document.getRoot().listNodes()) {
    if (node.getExtras().cameraViewId) throw new Error("Overview proxies must not be interactive");
    if (!node.getMatrix().every(Number.isFinite)) throw new Error(`Invalid transform: ${node.getName()}`);
    const source = sourceNodes.get(node.getName());
    if (source && !node.getMatrix().every((value, index) => value === source.matrix[index])) {
      throw new Error(`Changed source transform: ${node.getName()}`);
    }
    for (const primitive of node.getMesh()?.listPrimitives() ?? []) {
      const positions = primitive.getAttribute("POSITION").getArray();
      const indices = primitive.getIndices().getArray();
      if (indices.length % 3 || !indices.length) throw new Error(`Invalid triangle count: ${node.getName()}`);
      if (!positions.every(Number.isFinite)) throw new Error(`Invalid coordinates: ${node.getName()}`);
      if (!indices.every((index) => index < positions.length / 3)) throw new Error(`Invalid index: ${node.getName()}`);
      const bounds = primitiveStats(primitive).bounds;
      if (source && bounds.min.some((value, axis) => value < source.bounds.min[axis] || bounds.max[axis] > source.bounds.max[axis])) {
        throw new Error(`Overview expands source bounds: ${node.getName()}`);
      }
    }
  }
}

await Promise.all([MeshoptDecoder.ready, MeshoptEncoder.ready, MeshoptSimplifier.ready]);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  "meshopt.decoder": MeshoptDecoder, "meshopt.encoder": MeshoptEncoder,
});
const document = new Document();
const scene = document.createScene("San Diego overview");
document.getRoot().setDefaultScene(scene);
const before = { triangles: 0, vertices: 0, primitives: 0, accessorPayloadBytes: 0, decodedBufferBytes: 0, byteLength: 0 };
const layers = [];

for (const source of sources) {
  const bytes = await fs.readFile(publicPath(source.manifest.modelUrl));
  if (hash(bytes) !== source.manifest.contentHash) throw new Error(`Stale source manifest: ${source.manifest.modelUrl}`);
  const input = await io.readBinary(bytes);
  const stats = documentStats(input);
  for (const key of Object.keys(stats)) before[key] += stats[key];
  before.byteLength += bytes.length;
  before.decodedBufferBytes += decodedBufferBytes(bytes);
  const sourceStats = new Map();
  for (const node of input.getRoot().listNodes()) {
    sourceNodes.set(node.getName(), { matrix: node.getMatrix(), bounds: node.getMesh() ? primitiveStats(node.getMesh().listPrimitives()[0]).bounds : null });
    const extras = { ...node.getExtras() }; delete extras.cameraViewId;
    node.setExtras(extras);
    for (const primitive of node.getMesh()?.listPrimitives() ?? []) {
      sourceStats.set(primitive, primitiveStats(primitive));
      // Missing NORMAL tells GLTFLoader to use shader-derived flat normals.
      // This removes upload memory and lets equal position/color vertices weld.
      primitive.setAttribute("NORMAL", null);
    }
  }
  await input.transform(weld());
  for (const node of input.getRoot().listNodes()) for (const primitive of node.getMesh()?.listPrimitives() ?? []) {
    const settings = policy(node.getName());
    const measuredErrorMeters = simplifyPrimitive(input, primitive, settings, node.getWorldMatrix());
    layers.push({ group: source.group, name: node.getName(), settings, measuredErrorMeters, before: sourceStats.get(primitive), after: primitiveStats(primitive) });
    console.log(`${node.getName()}: ${sourceStats.get(primitive).triangles.toLocaleString()} → ${primitiveStats(primitive).triangles.toLocaleString()} triangles`);
  }
  await input.transform(prune());
  const map = mergeDocuments(document, input);
  const group = document.createNode(source.group);
  for (const inputScene of input.getRoot().listScenes()) {
    const copiedScene = map.get(inputScene);
    for (const node of copiedScene.listChildren()) group.addChild(node);
    copiedScene.dispose();
  }
  scene.addChild(group);
}

await document.transform(dedup(), prune(), unpartition(), reorder({ encoder: MeshoptEncoder, target: "size" }));
document.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.QUANTIZE });
validate(document);
const output = await io.writeBinary(document);
const decoded = await io.readBinary(output);
validate(decoded);
const after = { ...documentStats(decoded), decodedBufferBytes: decodedBufferBytes(output), byteLength: output.byteLength };
const reduction = Object.fromEntries(["triangles", "vertices", "decodedBufferBytes", "byteLength"].map((key) => [key, 1 - after[key] / before[key]]));
const manifest = {
  version: 1, modelUrl, contentHash: hash(output), byteLength: output.byteLength,
  originalModel: { modelUrl: original.modelUrl, contentHash: original.contentHash },
  regionalModel: { modelUrl: regional.modelUrl, contentHash: regional.contentHash },
  groups: { region: "overview-region", original: "overview-original" },
  attribution: "© OpenStreetMap contributors · Map3D (MIT)",
  generation: {
    command: "npm run data:san-diego-overview", source: "The exact full-detail GLBs referenced above; no map download or source regeneration.",
    algorithm: "Drop normals, weld matching position/color vertices, retain upward-facing building roof/campus triangles, run topology/color-seam-aware meshoptimizer edge collapses, compact every vertex/index buffer, deduplicate and meshopt-compress lossless Float32 positions.",
    surfaceProtection: "Ocean retained exactly. Landscape, beach and creek topological borders are locked. All surface vertices within 1 m of the original-patch perimeter are locked. Other surface errors use conservative absolute meter limits; unchanged source vertex colors and source node transforms are retained.",
    shading: "Normals are derived per face by GLTFLoader/Three.js flat shading; no normal buffers or textures are downloaded or uploaded.",
    memoryMetric: "decodedBufferBytes sums decoded glTF buffer-view capacities, including padded attribute strides, matching Three.js geometry upload buffers. accessorPayloadBytes excludes stride padding. Neither metric includes GPU driver overhead, render targets, JavaScript objects, or temporary decompression allocations.",
    limitations: "Overview only: building facades/undersides and tiny architectural details are omitted; trees are coarsened. Error meters are meshoptimizer's positional metric, not a proven maximum surface distance. Districts and landmarks must use full-detail source assets.",
    deterministic: "No timestamps or random sampling. Run with the checked-in package lock and current source hashes.",
    compression: { extension: "EXT_meshopt_compression", positions: "lossless Float32", colors: "source 8-bit", normals: "omitted; shader-derived flat normals" },
  },
  stats: { before, after, reduction, layers },
};
await fs.writeFile(publicPath(modelUrl), output);
await fs.writeFile(publicPath(manifestUrl), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(JSON.stringify({ modelUrl, contentHash: manifest.contentHash, before, after, reduction }, null, 2));
