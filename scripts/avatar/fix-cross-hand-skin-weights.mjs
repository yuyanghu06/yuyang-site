import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const inputPath = path.resolve(process.argv[2] ?? "");
const outputPath = path.resolve(process.argv[3] ?? "");
if (!process.argv[2] || !process.argv[3]) {
  throw new Error("Usage: fix-cross-hand-skin-weights.mjs <input.glb> <output.glb>");
}
const bytes = await readFile(inputPath);
const document = parseGlb(bytes);
const json = document.json;
const primitive = json.meshes[0].primitives[0];
const positions = accessorView(json, document.bin, primitive.attributes.POSITION);
const joints = accessorView(json, document.bin, primitive.attributes.JOINTS_0);
const weights = accessorView(json, document.bin, primitive.attributes.WEIGHTS_0);
const skinJoints = json.skins[0].joints;
const names = skinJoints.map((node) => json.nodes[node].name ?? "");
const handBone = (name) => /^(Left|Right)(Shoulder|Arm|ForeArm|Hand|Thumb|Index|Middle|Ring|Pinky)/.test(name);
let changedVertices = 0;
let removedInfluences = 0;
let removedWeight = 0;
for (let vertex = 0; vertex < positions.count; vertex += 1) {
  const x = positions.array[vertex * 3];
  if (Math.abs(x) < 0.13) continue;
  const expected = x < 0 ? "Right" : "Left";
  const opposite = expected === "Right" ? "Left" : "Right";
  let changed = false;
  for (let slot = 0; slot < 4; slot += 1) {
    const offset = vertex * 4 + slot;
    const name = names[joints.array[offset]];
    if (name.startsWith(opposite) && handBone(name) && weights.array[offset] > 0) {
      removedWeight += weights.array[offset];
      weights.array[offset] = 0;
      removedInfluences += 1;
      changed = true;
    }
  }
  if (!changed) continue;
  let total = 0;
  for (let slot = 0; slot < 4; slot += 1) total += weights.array[vertex * 4 + slot];
  if (total <= 1e-8) {
    const handIndex = names.indexOf(`${expected}Hand`);
    joints.array[vertex * 4] = handIndex;
    weights.array[vertex * 4] = 1;
    total = 1;
  }
  for (let slot = 0; slot < 4; slot += 1) weights.array[vertex * 4 + slot] /= total;
  changedVertices += 1;
}
await writeFile(outputPath, packGlb(json, document.bin));
console.log(JSON.stringify({ outputPath, changedVertices, removedInfluences, removedWeight }, null, 2));

function accessorView(json, bin, accessorIndex) {
  const accessor = json.accessors[accessorIndex];
  const view = json.bufferViews[accessor.bufferView];
  const byteOffset = (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
  const length = accessor.count * components(accessor.type);
  const constructors = { 5121: Uint8Array, 5123: Uint16Array, 5125: Uint32Array, 5126: Float32Array };
  const Constructor = constructors[accessor.componentType];
  if (!Constructor) throw new Error(`Unsupported component type ${accessor.componentType}`);
  return { accessor, count: accessor.count, array: new Constructor(bin.buffer, bin.byteOffset + byteOffset, length) };
}
function components(type) { return { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 }[type]; }
function parseGlb(source) {
  const jsonLength = source.readUInt32LE(12);
  const json = JSON.parse(source.subarray(20, 20 + jsonLength).toString());
  const binHeader = 20 + jsonLength;
  const binLength = source.readUInt32LE(binHeader);
  return { json, bin: Buffer.from(source.subarray(binHeader + 8, binHeader + 8 + binLength)) };
}
function packGlb(json, sourceBin) {
  let jsonBytes = Buffer.from(JSON.stringify(json));
  const jsonPadding = (4 - jsonBytes.length % 4) % 4;
  if (jsonPadding) jsonBytes = Buffer.concat([jsonBytes, Buffer.alloc(jsonPadding, 0x20)]);
  const binPadding = (4 - sourceBin.length % 4) % 4;
  const bin = binPadding ? Buffer.concat([sourceBin, Buffer.alloc(binPadding)]) : sourceBin;
  const output = Buffer.alloc(28 + jsonBytes.length + bin.length);
  output.write("glTF"); output.writeUInt32LE(2, 4); output.writeUInt32LE(output.length, 8);
  output.writeUInt32LE(jsonBytes.length, 12); output.write("JSON", 16); jsonBytes.copy(output, 20);
  const binHeader = 20 + jsonBytes.length; output.writeUInt32LE(bin.length, binHeader); output.write("BIN\0", binHeader + 4); bin.copy(output, binHeader + 8);
  return output;
}
