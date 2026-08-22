import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import * as THREE from "three";
import { VRMLoaderPlugin, type VRM, type VRMHumanBoneName } from "@pixiv/three-vrm";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { sourceBoneToHumanBone } from "../../src/components/avatar-view/vrm-animation/VrmAnimationContract";

const avatarPath = path.resolve(
  process.argv[2] ?? "public/models/yuyang-avatar-vrm1-review.glb",
);
const libraryPath = path.resolve(
  process.argv[3] ?? "public/models/quaternius-vrm-animation-library.glb",
);
const outputPath = path.resolve(
  process.argv[4] ?? "public/models/yuyang-avatar-vrm1-idle-embedded-review.glb",
);

globalThis.ProgressEvent ??= class ProgressEvent extends Event {
  readonly lengthComputable = false;
  readonly loaded = 0;
  readonly total = 0;
} as typeof ProgressEvent;

const avatarBytes = await readFile(avatarPath);
const libraryBytes = await readFile(libraryPath);
let documentBin = Buffer.alloc(0);
const avatarDocument = parseGlb(avatarBytes);
const loadableAvatar = createTexturelessLoadCopy(avatarDocument);

const avatarLoader = new GLTFLoader();
avatarLoader.register((parser) => new VRMLoaderPlugin(parser));
const [avatarGltf, libraryGltf] = await Promise.all([
  avatarLoader.parseAsync(toArrayBuffer(loadableAvatar), ""),
  new GLTFLoader().parseAsync(toArrayBuffer(libraryBytes), ""),
]);
const vrm = avatarGltf.userData.vrm as VRM | undefined;
if (!vrm) throw new Error("The avatar did not load as VRM 1.0");

const idleClip = libraryGltf.animations.find((clip) => clip.name === "Idle_Loop");
const restClip = libraryGltf.animations.find((clip) => clip.name === "A_TPose");
if (!idleClip || !restClip) throw new Error("Animation library is missing Idle_Loop or A_TPose");
const sampleTimes = Array.from(idleClip.tracks[0]?.times ?? []);
if (sampleTimes.length === 0) throw new Error("Idle_Loop has no samples");

const humanBoneNames = Array.from(
  new Set(Object.values(sourceBoneToHumanBone)),
) as VRMHumanBoneName[];
const rawBones = new Map<VRMHumanBoneName, THREE.Object3D>();
for (const humanBoneName of humanBoneNames) {
  const bone = vrm.humanoid.getRawBoneNode(humanBoneName);
  if (!bone) throw new Error(`VRM is missing raw bone ${humanBoneName}`);
  rawBones.set(humanBoneName, bone);
}

const rotations = new Map<VRMHumanBoneName, Float32Array>();
for (const humanBoneName of humanBoneNames) {
  rotations.set(humanBoneName, new Float32Array(sampleTimes.length * 4));
}
const hipsPositions = new Float32Array(sampleTimes.length * 3);
const restTracks = quaternionTracks(restClip);
const idleTracks = quaternionTracks(idleClip);
const sourceNameByHumanBone = new Map<VRMHumanBoneName, string>();
for (const [sourceName, humanBoneName] of Object.entries(sourceBoneToHumanBone)) {
  sourceNameByHumanBone.set(humanBoneName, sourceName);
}
const sourceRest = new THREE.Quaternion();
const sourceReference = new THREE.Quaternion();
const sourcePose = new THREE.Quaternion();
const sourceDelta = new THREE.Quaternion();
const conversion = new THREE.Quaternion();
const mappedDelta = new THREE.Quaternion();
for (const [humanBoneName, targetBone] of rawBones) {
  const sourceName = sourceNameByHumanBone.get(humanBoneName)!;
  const restTrack = restTracks.get(sourceName);
  const motionTrack = idleTracks.get(sourceName);
  if (!restTrack || !motionTrack) throw new Error(`Missing source track ${sourceName}`);
  sourceRest.fromArray(restTrack.values, 0);
  sourceReference.fromArray(motionTrack.values, 0);
  const targetRest = targetBone.quaternion.clone();
  conversion.copy(targetRest).invert().multiply(sourceRest);
  const output = rotations.get(humanBoneName)!;
  for (let frame = 0; frame < sampleTimes.length; frame += 1) {
    if (humanBoneName.startsWith("rightLittle")) {
      targetRest.toArray(output, frame * 4);
      continue;
    }
    sourcePose.fromArray(motionTrack.values, frame * 4);
    sourceDelta.copy(sourceReference).invert().multiply(sourcePose).normalize();
    mappedDelta
      .copy(conversion)
      .multiply(sourceDelta)
      .multiply(conversion.clone().invert())
      .normalize();
    targetRest.clone().multiply(mappedDelta).normalize().toArray(output, frame * 4);
  }
  output.set(output.subarray(0, 4), output.length - 4);
}
const hipsRestPosition = rawBones.get("hips")!.position;
for (let frame = 0; frame < sampleTimes.length; frame += 1) {
  hipsRestPosition.toArray(hipsPositions, frame * 3);
}

embedAnimation(
  avatarDocument.json,
  avatarDocument.bin,
  sampleTimes,
  rotations,
  hipsPositions,
);
await writeFile(outputPath, packGlb(avatarDocument.json, avatarDocument.bin));
console.log(`Wrote embedded idle review GLB: ${outputPath}`);

interface GlbDocument {
  json: Record<string, any>;
  bin: Buffer;
}

function parseGlb(bytes: Buffer): GlbDocument {
  if (bytes.toString("ascii", 0, 4) !== "glTF") throw new Error("Input is not GLB");
  const jsonLength = bytes.readUInt32LE(12);
  const json = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString("utf8"));
  const binHeader = 20 + jsonLength;
  const binLength = bytes.readUInt32LE(binHeader);
  const binType = bytes.toString("ascii", binHeader + 4, binHeader + 8);
  if (binType !== "BIN\0") throw new Error("GLB is missing its BIN chunk");
  return {
    json,
    bin: Buffer.from(bytes.subarray(binHeader + 8, binHeader + 8 + binLength)),
  };
}

function createTexturelessLoadCopy(document: GlbDocument) {
  const json = structuredClone(document.json);
  for (const material of json.materials ?? []) {
    if (material.pbrMetallicRoughness) {
      delete material.pbrMetallicRoughness.baseColorTexture;
      delete material.pbrMetallicRoughness.metallicRoughnessTexture;
    }
    delete material.normalTexture;
    delete material.occlusionTexture;
    delete material.emissiveTexture;
  }
  return packGlb(json, document.bin);
}

function embedAnimation(
  json: Record<string, any>,
  originalBin: Buffer,
  times: number[],
  rotations: Map<VRMHumanBoneName, Float32Array>,
  hipsPositions: Float32Array,
) {
  const appended: Buffer[] = [];
  let byteOffset = originalBin.length;
  const align = () => {
    const padding = (4 - (byteOffset % 4)) % 4;
    if (padding) {
      appended.push(Buffer.alloc(padding));
      byteOffset += padding;
    }
  };
  const addAccessor = (
    values: Float32Array,
    type: "SCALAR" | "VEC3" | "VEC4",
    count: number,
    min?: number[],
    max?: number[],
  ) => {
    align();
    const bytes = Buffer.from(values.buffer, values.byteOffset, values.byteLength);
    const bufferView = json.bufferViews.length;
    json.bufferViews.push({ buffer: 0, byteOffset, byteLength: bytes.length });
    const accessor = json.accessors.length;
    json.accessors.push({
      bufferView,
      componentType: 5126,
      count,
      type,
      ...(min ? { min } : {}),
      ...(max ? { max } : {}),
    });
    appended.push(bytes);
    byteOffset += bytes.length;
    return accessor;
  };

  const timeValues = Float32Array.from(times);
  const timeAccessor = addAccessor(
    timeValues,
    "SCALAR",
    times.length,
    [times[0]],
    [times.at(-1)!],
  );
  const samplers: Array<Record<string, any>> = [];
  const channels: Array<Record<string, any>> = [];
  const nodeIndexByName = new Map<string, number>(
    json.nodes.map((node: { name?: string }, index: number) => [node.name ?? "", index]),
  );
  const humanBoneMap = json.extensions.VRMC_vrm.humanoid.humanBones;
  for (const [humanBoneName, values] of rotations) {
    const node = humanBoneMap[humanBoneName]?.node;
    if (node === undefined || nodeIndexByName.get(json.nodes[node].name) !== node) {
      throw new Error(`Cannot resolve output node for ${humanBoneName}`);
    }
    const output = addAccessor(values, "VEC4", times.length);
    const sampler = samplers.length;
    samplers.push({ input: timeAccessor, output, interpolation: "LINEAR" });
    channels.push({ sampler, target: { node, path: "rotation" } });
  }
  const hipsNode = humanBoneMap.hips.node;
  const hipsOutput = addAccessor(hipsPositions, "VEC3", times.length);
  samplers.push({ input: timeAccessor, output: hipsOutput, interpolation: "LINEAR" });
  channels.push({ sampler: samplers.length - 1, target: { node: hipsNode, path: "translation" } });
  json.animations = [{ name: "Idle_Loop", samplers, channels }];
  json.buffers[0].byteLength = byteOffset;
  documentBin = Buffer.concat([originalBin, ...appended]);
}

function packGlb(json: Record<string, any>, fallbackBin: Buffer) {
  let jsonBytes = Buffer.from(JSON.stringify(json));
  const jsonPadding = (4 - (jsonBytes.length % 4)) % 4;
  if (jsonPadding) jsonBytes = Buffer.concat([jsonBytes, Buffer.alloc(jsonPadding, 0x20)]);
  const selectedBin = documentBin.length > 0 ? documentBin : fallbackBin;
  const binPadding = (4 - (selectedBin.length % 4)) % 4;
  const bin = binPadding
    ? Buffer.concat([selectedBin, Buffer.alloc(binPadding)])
    : selectedBin;
  const result = Buffer.alloc(12 + 8 + jsonBytes.length + 8 + bin.length);
  result.write("glTF", 0, "ascii");
  result.writeUInt32LE(2, 4);
  result.writeUInt32LE(result.length, 8);
  result.writeUInt32LE(jsonBytes.length, 12);
  result.write("JSON", 16, "ascii");
  jsonBytes.copy(result, 20);
  const binHeader = 20 + jsonBytes.length;
  result.writeUInt32LE(bin.length, binHeader);
  result.write("BIN\0", binHeader + 4, "ascii");
  bin.copy(result, binHeader + 8);
  return result;
}

function toArrayBuffer(bytes: Buffer) {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}

function quaternionTracks(clip: THREE.AnimationClip) {
  const tracks = new Map<string, THREE.KeyframeTrack>();
  for (const track of clip.tracks) {
    const parsed = THREE.PropertyBinding.parseTrackName(track.name);
    if (parsed.nodeName && parsed.propertyName === "quaternion") {
      tracks.set(parsed.nodeName, track);
    }
  }
  return tracks;
}
