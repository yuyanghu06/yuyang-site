import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import * as THREE from "three";
import { VRMLoaderPlugin, type VRM, type VRMHumanBoneName } from "@pixiv/three-vrm";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { retargetHumanoidAnimationClips } from "../../src/components/avatar-view/vrm-animation/VrmAnimation";
import { sourceBoneToHumanBone } from "../../src/components/avatar-view/vrm-animation/VrmAnimationContract";

const avatarPath = path.resolve(
  process.argv[2] ?? "public/models/yuyang-avatar-vrm1-arm-swapped-recovery-rig.glb",
);
const libraryPath = path.resolve(
  process.argv[3] ?? "public/models/quaternius-vrm-animation-library.glb",
);
const outputPath = path.resolve(
  process.argv[4] ?? "public/models/yuyang-avatar-vrm1-idle-arm-swapped-recovery.glb",
);
const mirrorArmMotion = process.argv.includes("--mirror-arms");
const swapArmMotion = process.argv.includes("--swap-arm-motion");
const reflectArmMotion = process.argv.includes("--reflect-arm-motion");

globalThis.ProgressEvent ??= class ProgressEvent extends Event {} as typeof ProgressEvent;
const avatarBytes = await readFile(avatarPath);
const libraryBytes = await readFile(libraryPath);
const document = parseGlb(avatarBytes);
const loadCopy = structuredClone(document.json);
for (const material of loadCopy.materials ?? []) {
  if (material.pbrMetallicRoughness) delete material.pbrMetallicRoughness.baseColorTexture;
  delete material.normalTexture;
}
const avatarLoader = new GLTFLoader();
avatarLoader.register((parser) => new VRMLoaderPlugin(parser));
const [avatarGltf, libraryGltf] = await Promise.all([
  avatarLoader.parseAsync(toArrayBuffer(packGlb(loadCopy, document.bin)), ""),
  new GLTFLoader().parseAsync(toArrayBuffer(libraryBytes), ""),
]);
const vrm = avatarGltf.userData.vrm as VRM;
const [clip] = retargetHumanoidAnimationClips(
  libraryGltf.animations,
  vrm,
  ["Idle_Loop"],
  { mirrorArmMotion, swapArmMotion, reflectArmMotion },
);
if (!clip) throw new Error("Idle_Loop retarget failed");
const times = Array.from(clip.tracks[0].times);
const humanBoneNames = Array.from(new Set(Object.values(sourceBoneToHumanBone))) as VRMHumanBoneName[];
const rotations = new Map<VRMHumanBoneName, Float32Array>();
for (const name of humanBoneNames) rotations.set(name, new Float32Array(times.length * 4));
const hipsPositions = new Float32Array(times.length * 3);
const mixer = new THREE.AnimationMixer(vrm.scene);
mixer.clipAction(clip).play();
for (let frame = 0; frame < times.length; frame += 1) {
  mixer.setTime(times[frame]);
  vrm.update(0);
  for (const name of humanBoneNames) {
    vrm.humanoid.getRawBoneNode(name)!.quaternion.toArray(rotations.get(name)!, frame * 4);
  }
  vrm.humanoid.getRawBoneNode("hips")!.position.toArray(hipsPositions, frame * 3);
}
embed(document, times, rotations, hipsPositions);
await writeFile(outputPath, packGlb(document.json, document.bin));
console.log(
  `Wrote absolute-retarget idle checkpoint: ${outputPath} (mirrored arms: ${mirrorArmMotion}, swapped arm motion: ${swapArmMotion}, reflected arm motion: ${reflectArmMotion})`,
);

function parseGlb(bytes: Buffer) {
  const jsonLength = bytes.readUInt32LE(12);
  const json = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString());
  const binHeader = 20 + jsonLength;
  const binLength = bytes.readUInt32LE(binHeader);
  return { json, bin: Buffer.from(bytes.subarray(binHeader + 8, binHeader + 8 + binLength)) };
}

function embed(
  target: { json: Record<string, any>; bin: Buffer },
  times: number[],
  rotations: Map<VRMHumanBoneName, Float32Array>,
  hipsPositions: Float32Array,
) {
  const { json } = target;
  const chunks: Buffer[] = [target.bin];
  let offset = target.bin.length;
  const add = (values: Float32Array, type: string, count: number, min?: number[], max?: number[]) => {
    const padding = (4 - (offset % 4)) % 4;
    if (padding) { chunks.push(Buffer.alloc(padding)); offset += padding; }
    const bytes = Buffer.from(values.buffer, values.byteOffset, values.byteLength);
    const bufferView = json.bufferViews.length;
    json.bufferViews.push({ buffer: 0, byteOffset: offset, byteLength: bytes.length });
    const accessor = json.accessors.length;
    json.accessors.push({ bufferView, componentType: 5126, count, type, ...(min ? { min } : {}), ...(max ? { max } : {}) });
    chunks.push(bytes); offset += bytes.length; return accessor;
  };
  const input = add(Float32Array.from(times), "SCALAR", times.length, [times[0]], [times.at(-1)!]);
  const channels = []; const samplers = [];
  const bones = json.extensions.VRMC_vrm.humanoid.humanBones;
  for (const [name, values] of rotations) {
    const output = add(values, "VEC4", times.length);
    samplers.push({ input, output, interpolation: "LINEAR" });
    channels.push({ sampler: samplers.length - 1, target: { node: bones[name].node, path: "rotation" } });
  }
  const hipsOutput = add(hipsPositions, "VEC3", times.length);
  samplers.push({ input, output: hipsOutput, interpolation: "LINEAR" });
  channels.push({ sampler: samplers.length - 1, target: { node: bones.hips.node, path: "translation" } });
  json.animations = [{ name: "Idle_Loop", channels, samplers }];
  json.buffers[0].byteLength = offset;
  target.bin = Buffer.concat(chunks);
}

function packGlb(json: Record<string, any>, binSource: Buffer) {
  let jsonBytes = Buffer.from(JSON.stringify(json));
  const jp = (4 - jsonBytes.length % 4) % 4;
  if (jp) jsonBytes = Buffer.concat([jsonBytes, Buffer.alloc(jp, 0x20)]);
  const bp = (4 - binSource.length % 4) % 4;
  const bin = bp ? Buffer.concat([binSource, Buffer.alloc(bp)]) : binSource;
  const out = Buffer.alloc(28 + jsonBytes.length + bin.length);
  out.write("glTF"); out.writeUInt32LE(2, 4); out.writeUInt32LE(out.length, 8);
  out.writeUInt32LE(jsonBytes.length, 12); out.write("JSON", 16); jsonBytes.copy(out, 20);
  const bh = 20 + jsonBytes.length; out.writeUInt32LE(bin.length, bh); out.write("BIN\0", bh + 4); bin.copy(out, bh + 8);
  return out;
}

function toArrayBuffer(bytes: Buffer) {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}
