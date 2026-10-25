/** Derive a deterministic, noninteractive overview without rewriting source detail. */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { gzipSync } from "node:zlib";
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
const sourceTrees = new Map();
const heightTargets = new Set(["Regional roads", "Mapped landcover"]);
const heightGridDenominator = 1024;
const protectedSeamMeters = 260;

function decodedBufferBytes(bytes) {
  const buffer = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const gltf = JSON.parse(buffer.toString("utf8", 20, 20 + buffer.readUInt32LE(12)));
  // Accessor element sizes omit glTF's padded NORMAL/COLOR byte strides.
  // Buffer views measure the actual decoded/upload capacity seen by Three.js.
  return gltf.bufferViews.reduce((sum, view) => sum + view.byteLength, 0);
}

// Error is meshoptimizer's absolute positional metric in meters, not a strict
// Hausdorff bound. Surfaces stay conservative because their elevations differ
// by centimeters near the original-patch seam. This baseline pass reuses source
// positions; the separate final height-storage pass is documented below.
function policy(name) {
  if (name === "Pacific Ocean" || /waterfall/.test(name)) return { kind: "retained", ratio: 1, errorMeters: 0 };
  if (/buildings|School|Plaza/.test(name)) return { kind: "rooftops", ratio: 0.05, errorMeters: 0.5, lockBorder: true };
  if (/trees/i.test(name)) return { kind: "trees", ratio: 1, errorMeters: 0 };
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

const accessorHash = (accessor) => hash(accessor.getArray());
const materialState = (material) => JSON.stringify([
  material.getBaseColorFactor(), material.getEmissiveFactor(), material.getMetallicFactor(),
  material.getRoughnessFactor(), material.getDoubleSided(), material.getAlphaMode(), material.getAlphaCutoff(),
]);

function captureGeometry(document) {
  const records = new Map();
  for (const node of document.getRoot().listNodes()) for (const [index, primitive] of (node.getMesh()?.listPrimitives() ?? []).entries()) {
    records.set(`${node.getName()}:${index}`, {
      matrix: JSON.stringify(node.getMatrix()), material: materialState(primitive.getMaterial()),
      indices: accessorHash(primitive.getIndices()), semantics: primitive.listSemantics().join(","),
      attributes: Object.fromEntries(primitive.listSemantics().map((semantic) => [semantic, accessorHash(primitive.getAttribute(semantic))])),
    });
  }
  return records;
}

function raiseSurfacePrecision(node, primitive) {
  const original = new Float32Array(primitive.getAttribute("POSITION").getArray());
  const positions = new Float32Array(original), indices = primitive.getIndices().getArray();
  const locks = new Uint8Array(positions.length / 3), matrix = node.getWorldMatrix();
  if (matrix[1] !== 0 || matrix[4] !== 0 || matrix[5] !== 1 || matrix[6] !== 0 || matrix[9] !== 0) {
    throw new Error(`Unsupported height transform: ${node.getName()}`);
  }
  const nearPatch = (index) => {
    const x = original[index * 3], y = original[index * 3 + 1], z = original[index * 3 + 2];
    const wx = matrix[0] * x + matrix[4] * y + matrix[8] * z + matrix[12];
    const wz = matrix[2] * x + matrix[6] * y + matrix[10] * z + matrix[14];
    const dx = Math.max(patch.min[0] - wx, 0, wx - patch.max[0]);
    const dz = Math.max(patch.min[2] - wz, 0, wz - patch.max[2]);
    return Math.hypot(dx, dz) <= protectedSeamMeters;
  };
  let seamTriangles = 0, verticalTriangles = 0;
  for (let index = 0; index < indices.length; index += 3) {
    const face = [indices[index], indices[index + 1], indices[index + 2]];
    const [a, b, c] = face.map((vertex) => vertex * 3);
    const areaXZ = (original[b] - original[a]) * (original[c + 2] - original[a + 2])
      - (original[b + 2] - original[a + 2]) * (original[c] - original[a]);
    const seam = face.some(nearPatch), vertical = areaXZ === 0;
    if (seam) seamTriangles++;
    if (vertical) verticalTriangles++;
    if (seam || vertical) for (const vertex of face) locks[vertex] = 1;
  }
  const minY = primitive.getAttribute("POSITION").getMin([])[1], maxY = primitive.getAttribute("POSITION").getMax([])[1];
  let extremaVertices = 0, changedVertices = 0, maxUpwardMeters = 0;
  for (let index = 0; index < locks.length; index++) {
    const y = original[index * 3 + 1], rounded = Math.ceil(y * heightGridDenominator) / heightGridDenominator;
    // Keep both old height bounds, including vertices whose upward rounding
    // would exceed the old maximum. No source coordinate is rounded downward.
    if (y === minY || y === maxY || rounded > maxY) { locks[index] = 1; extremaVertices++; }
    if (locks[index]) continue;
    positions[index * 3 + 1] = rounded;
    if (rounded !== y) changedVertices++;
    maxUpwardMeters = Math.max(maxUpwardMeters, rounded - y);
  }
  primitive.getAttribute("POSITION").setArray(positions);
  return { original, locks, summary: {
    name: node.getName(), vertices: locks.length, changedVertices,
    lockedVertices: locks.reduce((sum, value) => sum + value, 0), seamTriangles, verticalTriangles, extremaVertices,
    minY, maxY, maxUpwardMeters, maxXZMovementMeters: 0,
  } };
}

function validateHeightPrecision(document, baseline, targets) {
  const seen = new Set();
  for (const node of document.getRoot().listNodes()) for (const [index, primitive] of (node.getMesh()?.listPrimitives() ?? []).entries()) {
    const key = `${node.getName()}:${index}`, expected = baseline.get(key), target = targets.get(key);
    if (!expected || expected.matrix !== JSON.stringify(node.getMatrix())
      || expected.material !== materialState(primitive.getMaterial())
      || expected.indices !== accessorHash(primitive.getIndices())
      || expected.semantics !== primitive.listSemantics().join(",")) throw new Error(`Changed baseline topology/material/transform: ${key}`);
    seen.add(key);
    for (const semantic of primitive.listSemantics()) {
      if (semantic !== "POSITION" || !target) {
        if (expected.attributes[semantic] !== accessorHash(primitive.getAttribute(semantic))) throw new Error(`Changed baseline ${semantic}: ${key}`);
        continue;
      }
      const actual = primitive.getAttribute("POSITION").getArray(), original = target.original;
      const actualBits = new Uint32Array(actual.buffer, actual.byteOffset, actual.length);
      const originalBits = new Uint32Array(original.buffer, original.byteOffset, original.length);
      if (actual.length !== original.length) throw new Error(`Changed baseline vertex count: ${key}`);
      for (let offset = 0; offset < actual.length; offset += 3) {
        const movement = actual[offset + 1] - original[offset + 1];
        if (actualBits[offset] !== originalBits[offset] || actualBits[offset + 2] !== originalBits[offset + 2]
          || !Number.isFinite(movement) || movement < 0 || movement > 1 / heightGridDenominator
          || (target.locks[offset / 3] && actualBits[offset + 1] !== originalBits[offset + 1])) {
          throw new Error(`Changed protected coordinate or height limit: ${key}`);
        }
      }
      if (primitive.getAttribute("POSITION").getMin([])[1] !== target.summary.minY
        || primitive.getAttribute("POSITION").getMax([])[1] !== target.summary.maxY) throw new Error(`Changed baseline height bounds: ${key}`);
    }
  }
  if (seen.size !== baseline.size || targets.size !== 2) throw new Error("Changed baseline mesh set");
}

function treeGeometry(primitive) {
  const position = primitive.getAttribute("POSITION").getArray();
  const color = primitive.getAttribute("COLOR_0").getArray();
  const indices = primitive.getIndices().getArray();
  const count = position.length / 3, positionIds = new Map(), keys = [], ids = new Uint32Array(count);
  const parent = new Uint32Array(count), used = new Uint8Array(count);
  for (let index = 0; index < count; index++) {
    const positionKey = Buffer.from(position.buffer, position.byteOffset + index * 3 * position.BYTES_PER_ELEMENT,
      3 * position.BYTES_PER_ELEMENT).toString("hex");
    const colorKey = Buffer.from(color.buffer, color.byteOffset + index * 3 * color.BYTES_PER_ELEMENT,
      3 * color.BYTES_PER_ELEMENT).toString("hex");
    if (!positionIds.has(positionKey)) {
      const id = positionIds.size;
      positionIds.set(positionKey, id); parent[id] = id;
    }
    ids[index] = positionIds.get(positionKey);
    keys.push(`${positionKey}:${colorKey}`);
  }
  const find = (id) => {
    while (parent[id] !== id) { parent[id] = parent[parent[id]]; id = parent[id]; }
    return id;
  };
  const faces = [];
  for (let index = 0; index < indices.length; index += 3) {
    const [a, b, c] = [indices[index], indices[index + 1], indices[index + 2]];
    const root = find(ids[a]);
    parent[find(ids[b])] = root; parent[find(ids[c])] = root;
    used[ids[a]] = used[ids[b]] = used[ids[c]] = 1;
    // Reordering may rotate a face's first vertex, but must preserve winding.
    faces.push([`${keys[a]}|${keys[b]}|${keys[c]}`, `${keys[b]}|${keys[c]}|${keys[a]}`,
      `${keys[c]}|${keys[a]}|${keys[b]}`].sort()[0]);
  }
  const components = new Set();
  for (let id = 0; id < positionIds.size; id++) if (used[id]) components.add(find(id));
  return { triangles: indices.length / 3, connectedComponents: components.size, geometryHash: hash(faces.sort().join("\n")) };
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
  const seenTrees = new Set();
  for (const node of document.getRoot().listNodes()) {
    if (node.getExtras().cameraViewId) throw new Error("Overview proxies must not be interactive");
    if (!node.getMatrix().every(Number.isFinite)) throw new Error(`Invalid transform: ${node.getName()}`);
    const source = sourceNodes.get(node.getName());
    if (source && !node.getMatrix().every((value, index) => value === source.matrix[index])) {
      throw new Error(`Changed source transform: ${node.getName()}`);
    }
    for (const [index, primitive] of (node.getMesh()?.listPrimitives() ?? []).entries()) {
      const positions = primitive.getAttribute("POSITION").getArray();
      const indices = primitive.getIndices().getArray();
      if (indices.length % 3 || !indices.length) throw new Error(`Invalid triangle count: ${node.getName()}`);
      if (!positions.every(Number.isFinite)) throw new Error(`Invalid coordinates: ${node.getName()}`);
      if (!indices.every((index) => index < positions.length / 3)) throw new Error(`Invalid index: ${node.getName()}`);
      const bounds = primitiveStats(primitive).bounds;
      if (source && bounds.min.some((value, axis) => value < source.bounds.min[axis] || bounds.max[axis] > source.bounds.max[axis])) {
        throw new Error(`Overview expands source bounds: ${node.getName()}`);
      }
      const expectedTree = sourceTrees.get(node.getName())?.[index];
      if (expectedTree) {
        seenTrees.add(node.getName());
        const actualTree = treeGeometry(primitive);
        if (actualTree.triangles !== expectedTree.triangles
          || actualTree.connectedComponents !== expectedTree.connectedComponents
          || actualTree.geometryHash !== expectedTree.geometryHash) {
          throw new Error(`Changed source tree geometry: ${node.getName()}`);
        }
      }
    }
  }
  for (const name of sourceTrees.keys()) if (!seenTrees.has(name)) throw new Error(`Missing source tree layer: ${name}`);
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
    if (/trees/i.test(node.getName())) sourceTrees.set(node.getName(), node.getMesh().listPrimitives().map(treeGeometry));
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
  for (const node of input.getRoot().listNodes()) for (const [index, primitive] of (node.getMesh()?.listPrimitives() ?? []).entries()) {
    const settings = policy(node.getName());
    const measuredErrorMeters = simplifyPrimitive(input, primitive, settings, node.getWorldMatrix());
    layers.push({ group: source.group, name: node.getName(), settings, measuredErrorMeters, before: sourceStats.get(primitive), after: primitiveStats(primitive),
      ...(settings.kind === "trees" ? { treePreservation: { treeCount: source.manifest.counts.trees,
        before: sourceTrees.get(node.getName())[index], after: treeGeometry(primitive) } } : {}),
    });
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
// Recreate the approved overview first, including its final cache/fetch order.
// This buffer is generated from the unchanged full sources, never a prior GLB.
const baselineOutput = await io.writeBinary(document);
const prepared = await io.readBinary(baselineOutput);
validate(prepared);
const baselineGeometry = captureGeometry(prepared), precisionTargets = new Map();
const baselineStats = { ...documentStats(prepared), decodedBufferBytes: decodedBufferBytes(baselineOutput),
  byteLength: baselineOutput.byteLength, gzipByteLength: gzipSync(baselineOutput).byteLength, contentHash: hash(baselineOutput) };
for (const node of prepared.getRoot().listNodes()) if (heightTargets.has(node.getName())) {
  for (const [index, primitive] of node.getMesh().listPrimitives().entries()) {
    precisionTargets.set(`${node.getName()}:${index}`, raiseSurfacePrecision(node, primitive));
  }
}
// No transforms, welding, simplification or reordering may follow this step.
validateHeightPrecision(prepared, baselineGeometry, precisionTargets);
validate(prepared);
const output = await io.writeBinary(prepared);
const decoded = await io.readBinary(output);
validate(decoded);
validateHeightPrecision(decoded, baselineGeometry, precisionTargets);
const after = { ...documentStats(decoded), decodedBufferBytes: decodedBufferBytes(output), byteLength: output.byteLength,
  gzipByteLength: gzipSync(output).byteLength };
const reduction = Object.fromEntries(["triangles", "vertices", "decodedBufferBytes", "byteLength"].map((key) => [key, 1 - after[key] / before[key]]));
const manifest = {
  version: 1, modelUrl, contentHash: hash(output), byteLength: output.byteLength,
  originalModel: { modelUrl: original.modelUrl, contentHash: original.contentHash },
  regionalModel: { modelUrl: regional.modelUrl, contentHash: regional.contentHash },
  groups: { region: "overview-region", original: "overview-original" },
  attribution: "© OpenStreetMap contributors · Map3D (MIT)",
  generation: {
    command: "npm run data:san-diego-overview", source: "The exact full-detail GLBs referenced above; no map download or source regeneration.",
    algorithm: "Recreate the approved overview from full source GLBs with its existing normal removal, welding, tree preservation, roof selection, surface simplification and final cache/fetch reorder. Then apply the documented upward-only height precision to two surface layers and Meshopt-compress, with no further geometry processing.",
    surfaceProtection: "Ocean retained exactly. Landscape, beach and creek topological borders are locked. All surface vertices within 1 m of the original-patch perimeter are locked. Other surface errors use conservative absolute meter limits; unchanged source vertex colors and source node transforms are retained.",
    heightStorage: {
      targets: [...heightTargets], gridDenominator: heightGridDenominator, maximumUpwardMeters: 1 / heightGridDenominator,
      baseline: "Recreate the approved overview from the exact full source GLBs using its existing policies and final cache/fetch reorder. Never read a previously generated overview as input.",
      method: "After the baseline is decoded, round only unlocked Y values upward to the next binary 1/1024-meter step. X/Z, indices, triangle order, color bytes, materials and transforms stay bit-exact. No subsequent geometry transformation occurs.",
      protection: "Freeze every vertex of a face with any vertex inside or within 260 m of the original-patch rectangle, and every face with exactly zero projected XZ area. Freeze minimum/maximum Y vertices and any vertex whose rounded Y would exceed the old maximum, preserving height bounds.",
      guarantee: "With unchanged projected triangles and nonnegative per-vertex height changes, every covered point stays at the same or greater height by at most 1/1024 m; no new burial or footprint gap is introduced. Vertical faces are frozen, so valid faces cannot collapse. Existing nearly coplanar color depth ties can shift below one millimeter.",
      validation: "Before writing and after decoding, compare every mesh's fixed topology, draw order, colors, materials and transforms; all 16 non-target position arrays must match exactly. Check target X/Z bits, upward-only height bound, locked coordinates and height extrema. All tree checks remain mandatory.",
      layers: [...precisionTargets.values()].map((target) => target.summary),
    },
    treeProtection: `All ${original.counts.trees} original and ${regional.counts.trees} regional trees retain every triangle, trunk/crown component, Float32 position, color byte and node transform. Normal buffers are omitted and equal position/color vertices may share storage; no tree simplification or deletion occurs. Source and decoded overview triangle hashes and component counts must match.`,
    shading: "Normals are derived per face by GLTFLoader/Three.js flat shading; no normal buffers or textures are downloaded or uploaded.",
    memoryMetric: "decodedBufferBytes sums decoded glTF buffer-view capacities, including padded attribute strides, matching Three.js geometry upload buffers. accessorPayloadBytes excludes stride padding. Neither metric includes GPU driver overhead, render targets, JavaScript objects, or temporary decompression allocations.",
    limitations: "The approved overview's building facade/underside omissions are unchanged. The new storage pass removes no geometry: triangle count, draw count and decoded geometry memory stay unchanged. Two surface layers move only upward by less than 0.977 mm, which can alter existing submillimeter color depth ties. All tree geometry remains exact. Legacy simplifier error meters are a positional metric, not a proven maximum surface distance; districts/landmarks retain full-detail source assets.",
    gzipMetric: "gzipByteLength uses Node.js gzipSync defaults on the generated GLB, measuring compressed asset bytes rather than device time or whole-page transfer. HTTP compression may differ.",
    deterministic: "No timestamps or random sampling. Run with the checked-in package lock and current source hashes.",
    compression: { extension: "EXT_meshopt_compression", positions: "Float32; two surface layers have upward-only submillimeter Y precision, all X/Z and other layers exact", colors: "source 8-bit", normals: "omitted; shader-derived flat normals" },
  },
  stats: { before, baseline: baselineStats, after, reduction,
    versusBaseline: { byteLength: 1 - after.byteLength / baselineStats.byteLength,
      gzipByteLength: 1 - after.gzipByteLength / baselineStats.gzipByteLength }, layers },
};
await fs.writeFile(publicPath(modelUrl), output);
await fs.writeFile(publicPath(manifestUrl), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(JSON.stringify({ modelUrl, contentHash: manifest.contentHash, before, after, reduction }, null, 2));
