import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

const rigPath = path.resolve(process.argv[2] ?? "public/models/yuyang-avatar-vrm1-arm-swapped-recovery-rig.glb");
const animatedPath = path.resolve(process.argv[3] ?? "public/models/yuyang-avatar-vrm1-idle-arm-swapped-recovery.glb");
const outputPath = path.resolve(process.argv[4] ?? "public/models/yuyang-avatar-vrm1-idle-target-space-arm-mirror-review.glb");
const replacementPath = process.argv[5] ? path.resolve(process.argv[5]) : null;
globalThis.ProgressEvent ??= class ProgressEvent extends Event {} as typeof ProgressEvent;

const rigBytes = await readFile(rigPath);
const animatedBytes = await readFile(animatedPath);
const replacementBytes = replacementPath ? await readFile(replacementPath) : null;
const document = parseGlb(rigBytes);
const loadRig = textureless(document);
const animatedDocument = parseGlb(animatedBytes);
const [rig, animated] = await Promise.all([
  new GLTFLoader().parseAsync(toArrayBuffer(packGlb(loadRig.json, loadRig.bin)), ""),
  new GLTFLoader().parseAsync(toArrayBuffer(packGlb(textureless(animatedDocument).json, animatedDocument.bin)), ""),
]);
const replacement = replacementBytes
  ? await (() => {
      const replacementDocument = textureless(parseGlb(replacementBytes));
      return new GLTFLoader().parseAsync(
        toArrayBuffer(packGlb(replacementDocument.json, replacementDocument.bin)),
        "",
      );
    })()
  : null;
const clip = animated.animations.find((value) => value.name === "Idle_Loop");
if (!clip) throw new Error("Recovered GLB is missing Idle_Loop");
const times = Array.from(clip.tracks[0]?.times ?? []);
if (!times.length) throw new Error("Idle_Loop has no samples");

const humanBones = document.json.extensions.VRMC_vrm.humanoid.humanBones as Record<string, { node: number }>;
const names = Object.keys(humanBones);
const rigNodes = new Map<string, THREE.Object3D>();
const animatedNodes = new Map<string, THREE.Object3D>();
const replacementNodes = new Map<string, THREE.Object3D>();
for (const humanName of names) {
  const nodeName = document.json.nodes[humanBones[humanName].node].name;
  const rigNode = rig.scene.getObjectByName(nodeName);
  const animatedNode = animated.scene.getObjectByName(nodeName);
  if (!rigNode || !animatedNode) throw new Error(`Cannot resolve ${humanName}: ${nodeName}`);
  rigNodes.set(humanName, rigNode);
  animatedNodes.set(humanName, animatedNode);
  if (replacement) {
    const replacementNode = replacement.scene.getObjectByName(nodeName);
    if (!replacementNode) throw new Error(`Cannot resolve replacement ${humanName}: ${nodeName}`);
    replacementNodes.set(humanName, replacementNode);
  }
}
rig.scene.updateMatrixWorld(true);
const restWorld = new Map<string, THREE.Quaternion>();
for (const [name, node] of rigNodes) restWorld.set(name, node.getWorldQuaternion(new THREE.Quaternion()));

const armOrder = [
  "Shoulder", "UpperArm", "LowerArm", "Hand",
  "ThumbMetacarpal", "ThumbProximal", "ThumbDistal",
  "IndexProximal", "IndexIntermediate", "IndexDistal",
  "MiddleProximal", "MiddleIntermediate", "MiddleDistal",
  "RingProximal", "RingIntermediate", "RingDistal",
  "LittleProximal", "LittleIntermediate", "LittleDistal",
];
const armNames = new Set(armOrder.flatMap((suffix) => [`left${suffix}`, `right${suffix}`]));
const rotations = new Map(names.map((name) => [name, new Float32Array(times.length * 4)]));
const hipsPositions = new Float32Array(times.length * 3);
const mixer = new THREE.AnimationMixer(animated.scene);
mixer.clipAction(clip).play();
const replacementClip = replacement?.animations.find((value) => value.name === "Idle_Loop");
if (replacement && !replacementClip) throw new Error("Replacement GLB is missing Idle_Loop");
const replacementMixer = replacement ? new THREE.AnimationMixer(replacement.scene) : null;
if (replacementMixer && replacementClip) replacementMixer.clipAction(replacementClip).play();
const reflection = new THREE.Matrix4().makeScale(-1, 1, 1);
const matrix = new THREE.Matrix4();
const mirroredMatrix = new THREE.Matrix4();

for (let frame = 0; frame < times.length; frame += 1) {
  mixer.setTime(times[frame]);
  animated.scene.updateMatrixWorld(true);
  if (replacementMixer && replacement) {
    replacementMixer.setTime(times[frame]);
    replacement.scene.updateMatrixWorld(true);
  }
  if (replacement) {
    for (const name of names) {
      const node = armNames.has(name) ? replacementNodes.get(name)! : animatedNodes.get(name)!;
      node.quaternion.toArray(rotations.get(name)!, frame * 4);
    }
    animatedNodes.get("hips")!.position.toArray(hipsPositions, frame * 3);
    continue;
  }
  const animatedWorld = new Map<string, THREE.Quaternion>();
  for (const [name, node] of animatedNodes) animatedWorld.set(name, node.getWorldQuaternion(new THREE.Quaternion()));
  const desiredWorld = new Map<string, THREE.Quaternion>();
  for (const name of names) {
    if (!armNames.has(name)) desiredWorld.set(name, animatedWorld.get(name)!.clone());
  }
  for (const suffix of armOrder) {
    for (const side of ["left", "right"] as const) {
      const targetName = `${side}${suffix}`;
      const sourceName = `${side === "left" ? "right" : "left"}${suffix}`;
      matrix.makeRotationFromQuaternion(animatedWorld.get(sourceName)!);
      mirroredMatrix.copy(reflection).multiply(matrix).multiply(reflection);
      desiredWorld.set(
        targetName,
        new THREE.Quaternion().setFromRotationMatrix(mirroredMatrix).normalize(),
      );
    }
  }
  for (const name of names) {
    const node = animatedNodes.get(name)!;
    let local: THREE.Quaternion;
    if (!armNames.has(name)) {
      local = node.quaternion.clone();
    } else {
      const parentHumanName = names.find((candidate) => animatedNodes.get(candidate) === node.parent);
      const parentWorld = parentHumanName
        ? desiredWorld.get(parentHumanName)!
        : node.parent!.getWorldQuaternion(new THREE.Quaternion());
      local = parentWorld.clone().invert().multiply(desiredWorld.get(name)!).normalize();
    }
    local.toArray(rotations.get(name)!, frame * 4);
  }
  animatedNodes.get("hips")!.position.toArray(hipsPositions, frame * 3);
}
for (const values of rotations.values()) values.set(values.subarray(0, 4), values.length - 4);
hipsPositions.set(hipsPositions.subarray(0, 3), hipsPositions.length - 3);
embed(document, times, rotations, hipsPositions);
await writeFile(outputPath, packGlb(document.json, document.bin));
console.log(`Wrote target-space mirrored arm review: ${outputPath}`);

function parseGlb(bytes: Buffer) {
  const jsonLength = bytes.readUInt32LE(12);
  const json = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString());
  const binHeader = 20 + jsonLength;
  const binLength = bytes.readUInt32LE(binHeader);
  return { json, bin: Buffer.from(bytes.subarray(binHeader + 8, binHeader + 8 + binLength)) };
}
function textureless(source: { json: Record<string, any>; bin: Buffer }) {
  const json = structuredClone(source.json);
  for (const value of json.materials ?? []) {
    if (value.pbrMetallicRoughness) delete value.pbrMetallicRoughness.baseColorTexture;
    delete value.normalTexture;
  }
  return { json, bin: source.bin };
}
function embed(target: { json: Record<string, any>; bin: Buffer }, times: number[], rotations: Map<string, Float32Array>, hips: Float32Array) {
  const { json } = target; const chunks = [target.bin]; let offset = target.bin.length;
  const add = (values: Float32Array, type: string, count: number, min?: number[], max?: number[]) => {
    const padding = (4 - offset % 4) % 4; if (padding) { chunks.push(Buffer.alloc(padding)); offset += padding; }
    const bytes = Buffer.from(values.buffer, values.byteOffset, values.byteLength);
    const bufferView = json.bufferViews.length; json.bufferViews.push({ buffer: 0, byteOffset: offset, byteLength: bytes.length });
    const accessor = json.accessors.length; json.accessors.push({ bufferView, componentType: 5126, count, type, ...(min ? { min } : {}), ...(max ? { max } : {}) });
    chunks.push(bytes); offset += bytes.length; return accessor;
  };
  const input = add(Float32Array.from(times), "SCALAR", times.length, [times[0]], [times.at(-1)!]);
  const samplers: Record<string, any>[] = []; const channels: Record<string, any>[] = [];
  for (const [name, values] of rotations) {
    const output = add(values, "VEC4", times.length); samplers.push({ input, output, interpolation: "LINEAR" });
    channels.push({ sampler: samplers.length - 1, target: { node: humanBones[name].node, path: "rotation" } });
  }
  const hipsOutput = add(hips, "VEC3", times.length); samplers.push({ input, output: hipsOutput, interpolation: "LINEAR" });
  channels.push({ sampler: samplers.length - 1, target: { node: humanBones.hips.node, path: "translation" } });
  json.animations = [{ name: "Idle_Loop", samplers, channels }]; json.buffers[0].byteLength = offset; target.bin = Buffer.concat(chunks);
}
function packGlb(json: Record<string, any>, sourceBin: Buffer) {
  let jsonBytes = Buffer.from(JSON.stringify(json)); const jp = (4 - jsonBytes.length % 4) % 4;
  if (jp) jsonBytes = Buffer.concat([jsonBytes, Buffer.alloc(jp, 0x20)]);
  const bp = (4 - sourceBin.length % 4) % 4; const bin = bp ? Buffer.concat([sourceBin, Buffer.alloc(bp)]) : sourceBin;
  const out = Buffer.alloc(28 + jsonBytes.length + bin.length); out.write("glTF"); out.writeUInt32LE(2, 4); out.writeUInt32LE(out.length, 8);
  out.writeUInt32LE(jsonBytes.length, 12); out.write("JSON", 16); jsonBytes.copy(out, 20); const bh = 20 + jsonBytes.length;
  out.writeUInt32LE(bin.length, bh); out.write("BIN\0", bh + 4); bin.copy(out, bh + 8); return out;
}
function toArrayBuffer(bytes: Buffer) { return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength); }
