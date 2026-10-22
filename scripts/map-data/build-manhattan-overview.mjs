/** Build one noninteractive building overview from immutable, decoded city tiles. */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { Document, NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS, EXTMeshoptCompression } from "@gltf-transform/extensions";
import { dedup, prune, quantize, reorder, weld } from "@gltf-transform/functions";
import { MeshoptDecoder, MeshoptEncoder } from "meshoptimizer";
import { Color, Euler, Matrix4, Quaternion, ShapeUtils, Vector2, Vector3 } from "three";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const directory = path.join(root, "public/models/washington-city");
const modelUrl = "/models/washington-city/overview.glb";
const detailsUrl = "/models/washington-city/details.json";
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const manifestBytes = await fs.readFile(path.join(directory, "manifest.json"));
const runtimeBytes = await fs.readFile(path.join(directory, "runtime.json"));
const sourceManifest = JSON.parse(manifestBytes);
const runtime = JSON.parse(runtimeBytes);
const parkPaths = ["public/data/washington-square-park.json", "public/data/union-square-park.json", "src/generated/ambient-layout.ts"];
const parkBytes = await Promise.all(parkPaths.map((file) => fs.readFile(path.join(root, file))));
const ambientJSON = parkBytes[2].toString().match(/^export const AMBIENT_LAYOUT = (.*) as const;$/m)?.[1];
if (!ambientJSON) throw new Error("Unexpected generated ambient layout format");
const parkRings = [...JSON.parse(parkBytes[0]).parkRings, ...JSON.parse(parkBytes[1]).parkRings,
  ...JSON.parse(ambientJSON).contextParkRings];
const parkNodeName = "overview-park-grass";
// These match the existing Manhattan eager-load coverage, including the Hudson cutoff.
const center = [220, 28, -400];
const tileRadius = 2600;
const minTileX = -1152;
const tiles = sourceManifest.tiles.filter((tile) => tile.x >= minTileX
  && Math.hypot(tile.x - center[0], tile.z - center[2]) < tileRadius);
const settings = { quantizePosition: 16, maxPositionErrorMeters: 0.07 };
const bounds = () => ({ min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] });
const include = (box, point) => {
  for (let axis = 0; axis < 3; axis++) {
    box.min[axis] = Math.min(box.min[axis], point[axis]);
    box.max[axis] = Math.max(box.max[axis], point[axis]);
  }
};

function decodedBufferBytes(bytes) {
  const buffer = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const gltf = JSON.parse(buffer.toString("utf8", 20, 20 + buffer.readUInt32LE(12)));
  return (gltf.bufferViews ?? []).reduce((sum, view) => sum + view.byteLength, 0);
}

function stats(document) {
  const result = { triangles: 0, vertices: 0, primitives: 0, accessorPayloadBytes: 0, bounds: bounds() };
  for (const accessor of document.getRoot().listAccessors()) result.accessorPayloadBytes += accessor.getArray().byteLength;
  for (const node of document.getRoot().listNodes()) for (const primitive of node.getMesh()?.listPrimitives() ?? []) {
    const position = primitive.getAttribute("POSITION");
    result.triangles += primitive.getIndices().getCount() / 3;
    result.vertices += position.getCount();
    result.primitives++;
    const matrix = node.getWorldMatrix(), point = [];
    for (let index = 0; index < position.getCount(); index++) {
      position.getElement(index, point);
      include(result.bounds, [
        matrix[0] * point[0] + matrix[4] * point[1] + matrix[8] * point[2] + matrix[12],
        matrix[1] * point[0] + matrix[5] * point[1] + matrix[9] * point[2] + matrix[13],
        matrix[2] * point[0] + matrix[6] * point[1] + matrix[10] * point[2] + matrix[14],
      ]);
    }
  }
  return result;
}

function validate(document, sourceBounds, positionTolerance, expectedTriangleCount) {
  let primitives = 0;
  for (const node of document.getRoot().listNodes()) {
    if (node.getExtras().cameraViewId || /road|ground/i.test(node.getName())) throw new Error("Unexpected overview layer");
    if (!node.getMatrix().every(Number.isFinite)) throw new Error("Invalid transform");
    for (const primitive of node.getMesh()?.listPrimitives() ?? []) {
      primitives++;
      const positions = primitive.getAttribute("POSITION").getArray();
      const colors = primitive.getAttribute("COLOR_0")?.getArray();
      const indices = primitive.getIndices().getArray();
      if (primitive.getAttribute("NORMAL")) throw new Error("Overview must use shader-derived flat normals");
      if (!positions.every(Number.isFinite) || (colors && !colors.every(Number.isFinite))) throw new Error("Invalid vertex data");
      if (!indices.length || indices.length % 3 || !indices.every((index) => index < positions.length / 3)) {
        throw new Error("Invalid triangle indices");
      }
    }
  }
  if (primitives !== 3) throw new Error(`Expected wall/roof/park batches; got ${primitives}`);
  const actualStats = stats(document);
  if (actualStats.triangles !== expectedTriangleCount) throw new Error("Changed source wall/roof triangle count");
  const actualBounds = actualStats.bounds;
  for (let axis = 0; axis < 3; axis++) for (const edge of ["min", "max"]) {
    if (Math.abs(actualBounds[edge][axis] - sourceBounds[edge][axis]) > positionTolerance) {
      throw new Error(`Changed overview bounds: ${edge}[${axis}]`);
    }
  }
}

await Promise.all([MeshoptDecoder.ready, MeshoptEncoder.ready]);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  "meshopt.decoder": MeshoptDecoder, "meshopt.encoder": MeshoptEncoder,
});
const document = new Document();
const scene = document.createScene("Manhattan building overview");
document.getRoot().setDefaultScene(scene);
const material = document.createMaterial("city-overview").setRoughnessFactor(1).setMetallicFactor(0);
const batches = new Map(["wall", "roof"].map((kind) => [kind, { positions: [], colors: [], indices: [], vertexCount: 0 }]));
const before = { byteLength: 0, decodedBufferBytes: 0, triangles: 0, vertices: 0, primitives: 0, accessorPayloadBytes: 0 };
const retainedBounds = bounds();
const sourceHash = createHash("sha256");
const sourceColors = new Set();
let maxGeographicBakeErrorMeters = 0;
const curatedLandmarks = [];
const curatedColors = {
  "1008875": { wall: 0x956553, roof: 0xb8aa9b }, "1008627": { wall: 0x6f5d54, roof: 0x8d8176 },
  "1008629": { wall: 0x8f5e50, roof: 0xaaa094 }, "1077346": { wall: 0x8f5e50, roof: 0xaaa094 },
  "1078952": { wall: 0xa9aaa5, roof: 0xc4c0b6 }, "1087304": { wall: 0xc49b72, roof: 0x94a184 },
  "1017906": { wall: 0xc7aa83, roof: 0x9b9384 },
};
const fittedModelSources = [];
let maxMaterialColorBakeError = 0;

for (const tile of tiles) {
  const bytes = await fs.readFile(path.join(directory, tile.file));
  sourceHash.update(tile.file).update(hash(bytes));
  const input = await io.readBinary(bytes);
  const inputStats = stats(input);
  before.byteLength += bytes.length;
  before.decodedBufferBytes += decodedBufferBytes(bytes);
  for (const key of ["triangles", "vertices", "primitives", "accessorPayloadBytes"]) before[key] += inputStats[key];
  for (const node of input.getRoot().listNodes()) {
    const batch = batches.get(node.getName());
    if (!batch) continue; // Building undersides are hidden below the separately loaded roadbed.
    const matrix = node.getWorldMatrix();
    for (const primitive of node.getMesh()?.listPrimitives() ?? []) {
      const position = primitive.getAttribute("POSITION"), color = primitive.getAttribute("COLOR_0");
      const positions = new Float32Array(position.getCount() * 3);
      const colors = new Uint8Array(position.getCount() * 3);
      const point = [];
      if (color.getArray().constructor !== Uint8Array || !color.getNormalized() || color.getElementSize() !== 3) {
        throw new Error(`Unexpected source palette: ${tile.file}`);
      }
      for (let index = 0; index < position.getCount(); index++) {
        position.getElement(index, point);
        const world = [
          matrix[0] * point[0] + matrix[4] * point[1] + matrix[8] * point[2] + matrix[12],
          matrix[1] * point[0] + matrix[5] * point[1] + matrix[9] * point[2] + matrix[13],
          matrix[2] * point[0] + matrix[6] * point[1] + matrix[10] * point[2] + matrix[14],
        ];
        positions.set(world, index * 3);
        maxGeographicBakeErrorMeters = Math.max(maxGeographicBakeErrorMeters,
          Math.hypot(...world.map((value, axis) => value - positions[index * 3 + axis])));
        include(retainedBounds, positions.subarray(index * 3, index * 3 + 3));
        const rgb = color.getArray().subarray(index * 3, index * 3 + 3);
        colors.set(rgb, index * 3);
        sourceColors.add(rgb.join(","));
      }
      batch.positions.push(positions);
      batch.colors.push(colors);
      batch.indices.push(Uint32Array.from(primitive.getIndices().getArray(), (index) => index + batch.vertexCount));
      batch.vertexCount += position.getCount();
    }
  }
}

function appendCurated(kind, positions, indices, color, doubleSided = false) {
  const batch = batches.get(kind), packedPositions = new Float32Array(positions);
  const linear = color.toArray(), rgb = linear.map((value) => Math.round(value * 255));
  maxMaterialColorBakeError = Math.max(maxMaterialColorBakeError,
    ...linear.map((value, axis) => Math.abs(value - rgb[axis] / 255)));
  const colors = new Uint8Array(positions.length), box = bounds();
  for (let offset = 0; offset < positions.length; offset += 3) {
    colors.set(rgb, offset);
    const point = packedPositions.subarray(offset, offset + 3);
    include(retainedBounds, point); include(box, point);
    maxGeographicBakeErrorMeters = Math.max(maxGeographicBakeErrorMeters,
      Math.hypot(...point.map((value, axis) => value - positions[offset + axis])));
  }
  const outputIndices = [...indices];
  if (doubleSided) for (let index = 0; index < indices.length; index += 3) {
    outputIndices.push(indices[index], indices[index + 2], indices[index + 1]);
  }
  sourceColors.add(rgb.join(","));
  batch.positions.push(packedPositions); batch.colors.push(colors);
  batch.indices.push(Uint32Array.from(outputIndices, (index) => index + batch.vertexCount));
  batch.vertexCount += positions.length / 3;
  return { triangles: outputIndices.length / 3, bounds: box };
}

function surfaceGeometry(surfaces) {
  const positions = [], indices = [];
  for (const surface of surfaces) {
    const ring = surface.ring, normal = new Vector3();
    for (let index = 0; index < ring.length; index++) {
      const a = ring[index], b = ring[(index + 1) % ring.length];
      normal.x += (a[1] - b[1]) * (a[2] + b[2]);
      normal.y += (a[2] - b[2]) * (a[0] + b[0]);
      normal.z += (a[0] - b[0]) * (a[1] + b[1]);
    }
    const axis = normal.clone().set(Math.abs(normal.x), Math.abs(normal.y), Math.abs(normal.z));
    const projected = (points) => points.map(([x, y, z]) => axis.x >= axis.y && axis.x >= axis.z
      ? new Vector2(z, y) : axis.y >= axis.z ? new Vector2(x, z) : new Vector2(x, y));
    const rings = [ring, ...surface.holes], points = rings.flat(), offset = positions.length / 3;
    for (const point of points) positions.push(...point);
    for (const face of ShapeUtils.triangulateShape(projected(ring), surface.holes.map(projected))) {
      const [a, b, c] = face.map((index) => new Vector3(...points[index]));
      if (b.sub(a).cross(c.sub(a)).dot(normal) < 0) face.reverse();
      indices.push(...face.map((index) => index + offset));
    }
  }
  return { positions, indices };
}

for (const [id, colors] of Object.entries(curatedColors)) {
  const surfaces = runtime.details[id];
  if (!surfaces?.length) throw new Error(`Missing curated building ${id}`);
  const box = bounds();
  for (const surface of surfaces) for (const point of surface.ring) include(box, point);
  if (id === "1008629") {
    // This record is in DETAIL_BINS but deliberately not in OMITTED_BINS.
    // Its base already exists in the unchanged tile; adding it again z-fights.
    const points = surfaces.flatMap((surface) => surface.ring);
    const average = (axis) => points.reduce((sum, point) => sum + point[axis], 0) / points.length;
    const file = `tile-${Math.floor(average(0) / sourceManifest.tileSize)}_${Math.floor(average(2) / sourceManifest.tileSize)}.glb`;
    if (!tiles.some((tile) => tile.file === file)) throw new Error("Existing curated base is outside overview tiles");
    curatedLandmarks.push({ id, coverage: "existing tile", file, bounds: box, colors });
    continue;
  }
  let triangles = 0;
  for (const kind of ["wall", "roof"]) {
    const geometry = surfaceGeometry(surfaces.filter((surface) => surface.kind === kind));
    // Interactive bases use DoubleSide. Opposite winding preserves that policy
    // in the existing front-sided shared batch without another material/draw.
    triangles += appendCurated(kind, geometry.positions, geometry.indices, new Color(colors[kind]), true).triangles;
  }
  curatedLandmarks.push({ id, coverage: "runtime.details base surfaces", triangles, bounds: box, colors });
}

for (const source of [
  { id: "1008626", file: "public/models/bobst-library.glb", kind: "Bobst Library" },
  { id: "1088400", file: "public/models/washington-square-arch.glb", kind: "Washington Square Arch" },
]) {
  const bytes = await fs.readFile(path.join(root, source.file)), input = await io.readBinary(bytes);
  if (input.getRoot().listTextures().length) throw new Error("Fitted overview source unexpectedly requires textures");
  let fit;
  if (source.id === "1008626") {
    fit = new Matrix4().compose(new Vector3(9.692, 2.688, 154.508),
      new Quaternion().setFromEuler(new Euler(0, 0.998781 + Math.PI * 3 / 2, 0)),
      new Vector3(69.633 / 33.586, 51.086 / 28.004, 64.53 / 36.674));
  } else {
    const box = stats(input).bounds, arch = JSON.parse(parkBytes[0]).arch;
    const footprint = arch.footprint.slice(0, -1);
    const location = [0, 1].map((axis) => footprint.reduce((sum, point) => sum + point[axis], 0) / footprint.length);
    const edge = [footprint[1][0] - footprint[0][0], footprint[1][1] - footprint[0][1]];
    const scale = arch.height / (box.max[1] - box.min[1]);
    fit = new Matrix4().makeTranslation(location[0], 0.68, location[1])
      .multiply(new Matrix4().makeRotationY(-Math.atan2(edge[1], edge[0])))
      .multiply(new Matrix4().makeScale(scale, scale, scale))
      .multiply(new Matrix4().makeTranslation(-(box.min[0] + box.max[0]) / 2, -box.min[1], -(box.min[2] + box.max[2]) / 2));
  }
  const box = bounds(); let triangles = 0;
  for (const node of input.getRoot().listNodes()) for (const primitive of node.getMesh()?.listPrimitives() ?? []) {
    const matrix = fit.clone().multiply(new Matrix4().fromArray(node.getWorldMatrix()));
    const position = primitive.getAttribute("POSITION"), positions = [], point = [];
    for (let index = 0; index < position.getCount(); index++) {
      position.getElement(index, point);
      const world = new Vector3(...point).applyMatrix4(matrix).toArray();
      positions.push(...world); include(box, world);
    }
    const color = source.id === "1088400" ? new Color(0xf1ede4)
      : new Color().fromArray(primitive.getMaterial().getBaseColorFactor());
    triangles += appendCurated("wall", positions, primitive.getIndices().getArray(), color,
      source.id === "1088400" || primitive.getMaterial().getDoubleSided()).triangles;
  }
  curatedLandmarks.push({ id: source.id, name: source.kind, coverage: "exact fitted model", triangles, bounds: box, fitMatrix: fit.toArray() });
  fittedModelSources.push({ file: source.file, contentHash: hash(bytes), byteLength: bytes.length });
}
if (curatedLandmarks.length !== 9 || !curatedLandmarks.every((record) => record.coverage)) throw new Error("Incomplete curated coverage");

function concat(arrays, Type) {
  const result = new Type(arrays.reduce((sum, array) => sum + array.length, 0));
  let offset = 0;
  for (const array of arrays) { result.set(array, offset); offset += array.length; }
  return result;
}

for (const [kind, batch] of batches) {
  const primitive = document.createPrimitive().setMaterial(material)
    .setAttribute("POSITION", document.createAccessor().setType("VEC3").setArray(concat(batch.positions, Float32Array)))
    .setAttribute("COLOR_0", document.createAccessor().setType("VEC3").setNormalized(true).setArray(concat(batch.colors, Uint8Array)))
    .setIndices(document.createAccessor().setType("SCALAR").setArray(concat(batch.indices, Uint32Array)));
  scene.addChild(document.createNode(kind).setMesh(document.createMesh(kind).addPrimitive(primitive)));
}
await document.transform(weld());
const layers = scene.listChildren().map((node) => ({
  name: node.getName(), triangles: node.getMesh().listPrimitives()[0].getIndices().getCount() / 3,
}));
const beforeQuantization = new Map(scene.listChildren().map((node) => [node.getName(),
  new Float32Array(node.getMesh().listPrimitives()[0].getAttribute("POSITION").getArray())]));
await document.transform(quantize({ pattern: /^POSITION$/, quantizePosition: settings.quantizePosition }));
let maxPositionQuantizationErrorMeters = 0;
for (const node of scene.listChildren()) {
  const previous = beforeQuantization.get(node.getName());
  const current = node.getMesh().listPrimitives()[0].getAttribute("POSITION");
  const matrix = node.getWorldMatrix(), point = [];
  if (previous.length !== current.getCount() * 3) throw new Error("Quantization changed vertex correspondence");
  for (let index = 0; index < current.getCount(); index++) {
    current.getElement(index, point);
    maxPositionQuantizationErrorMeters = Math.max(maxPositionQuantizationErrorMeters, Math.hypot(
      matrix[0] * point[0] + matrix[12] - previous[index * 3],
      matrix[5] * point[1] + matrix[13] - previous[index * 3 + 1],
      matrix[10] * point[2] + matrix[14] - previous[index * 3 + 2],
    ));
  }
}
const maxPositionErrorMeters = maxGeographicBakeErrorMeters + maxPositionQuantizationErrorMeters;
if (maxPositionErrorMeters > settings.maxPositionErrorMeters) throw new Error("Overview position error exceeds 7 cm");
// Match the existing surface triangulation exactly. Keep parks outside position
// quantization so their 0.74 m elevation agrees with the road stencil contract.
const parkPositions = [], parkIndices = [];
for (const ring of parkRings) {
  const offset = parkPositions.length / 3;
  for (const [x, z] of ring) parkPositions.push(x, 0.74, z);
  for (const face of ShapeUtils.triangulateShape(ring.map(([x, z]) => new Vector2(x, z)), [])) {
    parkIndices.push(...face.map((index) => index + offset));
  }
}
const grassPositions = new Float32Array(parkPositions);
for (let index = 0; index < grassPositions.length; index += 3) include(retainedBounds, grassPositions.subarray(index, index + 3));
const grass = document.createPrimitive()
  .setAttribute("POSITION", document.createAccessor().setType("VEC3").setArray(grassPositions))
  .setIndices(document.createAccessor().setType("SCALAR").setArray(new Uint32Array(parkIndices)))
  .setMaterial(document.createMaterial("Manhattan park grass").setBaseColorFactor([...new Color(0x9dbd7c).toArray(), 1])
    .setRoughnessFactor(1).setMetallicFactor(0).setDoubleSided(true));
scene.addChild(document.createNode(parkNodeName).setMesh(document.createMesh(parkNodeName).addPrimitive(grass)));
layers.push({ name: parkNodeName, rings: parkRings.length, triangles: parkIndices.length / 3 });
await document.transform(dedup(), prune(), reorder({ encoder: MeshoptEncoder, target: "size" }));
const buffer = document.createBuffer();
for (const accessor of document.getRoot().listAccessors()) accessor.setBuffer(buffer);
document.createExtension(EXTMeshoptCompression).setRequired(true)
  .setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.QUANTIZE });
const expectedTriangleCount = [...batches.values()].reduce((sum, batch) => sum
  + batch.indices.reduce((count, indices) => count + indices.length / 3, 0), 0) + parkIndices.length / 3;
validate(document, retainedBounds, maxPositionErrorMeters + 0.001, expectedTriangleCount);
const output = await io.writeBinary(document);
const decoded = await io.readBinary(output);
validate(decoded, retainedBounds, maxPositionErrorMeters + 0.001, expectedTriangleCount);
for (const mesh of decoded.getRoot().listMeshes()) for (const primitive of mesh.listPrimitives()) {
  const colors = primitive.getAttribute("COLOR_0")?.getArray();
  if (!colors) continue;
  for (let index = 0; index < colors.length; index += 3) {
    if (!sourceColors.has(colors.subarray(index, index + 3).join(","))) throw new Error("Changed source palette");
  }
}
const after = { ...stats(decoded), decodedBufferBytes: decodedBufferBytes(output), byteLength: output.byteLength };
const reduction = Object.fromEntries(["triangles", "vertices", "decodedBufferBytes", "byteLength"]
  .map((key) => [key, 1 - after[key] / before[key]]));
const details = Buffer.from(JSON.stringify({ details: runtime.details }));
const manifest = {
  version: 1, modelUrl, contentHash: hash(output), byteLength: output.byteLength,
  details: { url: detailsUrl, contentHash: hash(details), byteLength: details.length },
  source: {
    manifestVersion: sourceManifest.version, manifestHash: hash(manifestBytes), runtimeHash: hash(runtimeBytes),
    tileContentHash: sourceHash.digest("hex"), tileCount: tiles.length, tileRadius, minTileX, center,
    parks: parkPaths.map((file, index) => ({ file, contentHash: hash(parkBytes[index]) })),
    fittedModels: fittedModelSources,
  },
  generation: {
    command: "node scripts/map-data/build-manhattan-overview.mjs",
    algorithm: "Decode immutable city tiles, restore omitted curated base surfaces from runtime.details and exactly fitted Bobst/arch source models, bake geographic transforms, omit buried building ground faces and normal buffers, batch wall/roof geometry, weld matching position/color vertices, quantize positions to 16 bits and meshopt-compress.",
    settings, positions: "Geographic positions retained on a 16-bit overview grid; measured maximum vertex displacement is recorded below and must remain below 7 cm.",
    maxGeographicBakeErrorMeters, maxPositionQuantizationErrorMeters, maxPositionErrorMeters,
    colors: "Exact existing tile RGB bytes; curated runtime/model linear colors rounded to normalized 8-bit RGB. Shader-derived flat normals.",
    maxMaterialColorBakeError,
    curatedLandmarks,
    parks: {
      nodeName: parkNodeName, rings: parkRings.length, color: "#9dbd7c", elevationMeters: 0.74,
      geometry: "Exact existing Washington Square, Union Square and ambient context park rings/triangulation; Float32 positions without overview quantization.",
      runtimeMaterial: "Apply stencilWrite=true, stencilRef=1, stencilFunc=NotEqualStencilFunc to this node; glTF does not encode Three.js stencil state. Retain the existing stencil-first road rendering.",
    },
    coverage: "The same tile-center radius and Hudson cutoff as the previous eager Manhattan tile load, plus all curated base-building silhouettes and the exactly fitted Bobst/arch models. Roads and interactive selection/details remain separate.",
    limitations: "Overview only. Hidden building undersides and procedural landmark trim/windows are omitted; positions move by less than 7 cm. Every source tile wall/roof triangle and RGB byte remain. Curated base surfaces retain their exact footprint/height/roof topology, and their linear colors round to 8-bit RGB. Full neighborhood tiles remain unchanged.",
    deterministic: "No timestamps, random sampling, downloads, or full-detail rewrites. Regenerate after city source tiles or runtime metadata change.",
    memoryMetric: "Decoded buffer-view capacities include padded strides; they exclude temporary decode allocations, JavaScript objects and GPU driver overhead.",
  },
  stats: { before, after, reduction, retainedSourceBounds: retainedBounds, layers },
};
await fs.writeFile(path.join(directory, "overview.glb"), output);
await fs.writeFile(path.join(directory, "details.json"), details);
await fs.writeFile(path.join(directory, "overview-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(JSON.stringify({ modelUrl, contentHash: manifest.contentHash, details: manifest.details, before, after, reduction, layers }, null, 2));
