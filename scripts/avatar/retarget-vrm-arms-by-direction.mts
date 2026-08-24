import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { sourceBoneToHumanBone } from "../../src/components/avatar-view/vrm-animation/VrmAnimationContract";

const targetPath = path.resolve(process.argv[2] ?? "public/models/yuyang-avatar-vrm1-idle-embedded-review.glb");
const libraryPath = path.resolve(process.argv[3] ?? "public/models/quaternius-vrm-animation-library.glb");
const outputPath = path.resolve(process.argv[4] ?? "public/models/yuyang-avatar-vrm1-idle-direction-arms-review.glb");
const sourceClipName = process.argv[5] ?? "Idle_Loop";
const targetClipName = process.argv[6] ?? "Idle_Loop";
globalThis.ProgressEvent ??= class ProgressEvent extends Event {} as typeof ProgressEvent;

const targetDocument = parseGlb(await readFile(targetPath));
const libraryBytes = await readFile(libraryPath);
const [target, source] = await Promise.all([
  new GLTFLoader().parseAsync(toArrayBuffer(packGlb(textureless(targetDocument).json, targetDocument.bin)), ""),
  new GLTFLoader().parseAsync(toArrayBuffer(libraryBytes), ""),
]);
const clip = source.animations.find((value) => value.name === sourceClipName);
if (!clip) throw new Error(`Animation library is missing ${sourceClipName}`);
const times = Array.from(clip.tracks[0]?.times ?? []);
const mixer = new THREE.AnimationMixer(source.scene);
mixer.clipAction(clip).play();
const targetClip = target.animations.find((value) => value.name === targetClipName);
if (!targetClip) throw new Error(`Target GLB is missing ${targetClipName}`);
const targetMixer = new THREE.AnimationMixer(target.scene);
targetMixer.clipAction(targetClip).play();

const targetBoneNameByHuman: Record<string, string> = {
  hips: "Hips", spine: "Spine02", chest: "Spine01", upperChest: "Spine", neck: "neck", head: "Head",
  leftShoulder: "LeftShoulder", leftUpperArm: "LeftArm", leftLowerArm: "LeftForeArm", leftHand: "LeftHand",
  rightShoulder: "RightShoulder", rightUpperArm: "RightArm", rightLowerArm: "RightForeArm", rightHand: "RightHand",
  leftThumbMetacarpal: "LeftThumb1", leftThumbProximal: "LeftThumb2", leftThumbDistal: "LeftThumb3",
  leftIndexProximal: "LeftIndex1", leftIndexIntermediate: "LeftIndex2", leftIndexDistal: "LeftIndex3",
  leftMiddleProximal: "LeftMiddle1", leftMiddleIntermediate: "LeftMiddle2", leftMiddleDistal: "LeftMiddle3",
  leftRingProximal: "LeftRing1", leftRingIntermediate: "LeftRing2", leftRingDistal: "LeftRing3",
  leftLittleProximal: "LeftPinky1", leftLittleIntermediate: "LeftPinky2", leftLittleDistal: "LeftPinky3",
  rightThumbMetacarpal: "RightThumb1", rightThumbProximal: "RightThumb2", rightThumbDistal: "RightThumb3",
  rightIndexProximal: "RightIndex1", rightIndexIntermediate: "RightIndex2", rightIndexDistal: "RightIndex3",
  rightMiddleProximal: "RightMiddle1", rightMiddleIntermediate: "RightMiddle2", rightMiddleDistal: "RightMiddle3",
  rightRingProximal: "RightRing1", rightRingIntermediate: "RightRing2", rightRingDistal: "RightRing3",
  rightLittleProximal: "RightPinky1", rightLittleIntermediate: "RightPinky2", rightLittleDistal: "RightPinky3",
};
const nodeIndexByName = new Map(targetDocument.json.nodes.map((node: { name?: string }, index: number) => [node.name ?? "", index]));
const targetHumanBones = targetDocument.json.extensions?.VRMC_vrm?.humanoid?.humanBones as Record<string, { node: number }> | undefined;
const targetNodes = new Map<string, THREE.Object3D>();
for (const [humanName, nodeName] of Object.entries(targetBoneNameByHuman)) {
  const entry = targetHumanBones?.[humanName] ?? { node: nodeIndexByName.get(nodeName) };
  if (entry.node === undefined) throw new Error(`Missing target node index ${humanName}: ${nodeName}`);
  const node = target.scene.getObjectByName(nodeName);
  if (!node) throw new Error(`Missing target node ${humanName}: ${nodeName}`);
  targetNodes.set(humanName, node);
}
const ual2SourceBoneToHuman: Record<string, string> = {
  pelvis: "hips", spine_01: "spine", spine_02: "chest", spine_03: "upperChest", neck_01: "neck", Head: "head",
  clavicle_l: "leftShoulder", upperarm_l: "leftUpperArm", lowerarm_l: "leftLowerArm", hand_l: "leftHand",
  clavicle_r: "rightShoulder", upperarm_r: "rightUpperArm", lowerarm_r: "rightLowerArm", hand_r: "rightHand",
  thumb_01_l: "leftThumbMetacarpal", thumb_02_l: "leftThumbProximal", thumb_03_l: "leftThumbDistal",
  index_01_l: "leftIndexProximal", index_02_l: "leftIndexIntermediate", index_03_l: "leftIndexDistal",
  middle_01_l: "leftMiddleProximal", middle_02_l: "leftMiddleIntermediate", middle_03_l: "leftMiddleDistal",
  ring_01_l: "leftRingProximal", ring_02_l: "leftRingIntermediate", ring_03_l: "leftRingDistal",
  pinky_01_l: "leftLittleProximal", pinky_02_l: "leftLittleIntermediate", pinky_03_l: "leftLittleDistal",
  thumb_01_r: "rightThumbMetacarpal", thumb_02_r: "rightThumbProximal", thumb_03_r: "rightThumbDistal",
  index_01_r: "rightIndexProximal", index_02_r: "rightIndexIntermediate", index_03_r: "rightIndexDistal",
  middle_01_r: "rightMiddleProximal", middle_02_r: "rightMiddleIntermediate", middle_03_r: "rightMiddleDistal",
  ring_01_r: "rightRingProximal", ring_02_r: "rightRingIntermediate", ring_03_r: "rightRingDistal",
  pinky_01_r: "rightLittleProximal", pinky_02_r: "rightLittleIntermediate", pinky_03_r: "rightLittleDistal",
};
const activeSourceMap = source.scene.getObjectByName("DEF-hips") ? sourceBoneToHumanBone : ual2SourceBoneToHuman;
const sourceNameByHuman = new Map(Object.entries(activeSourceMap).map(([sourceName, humanName]) => [humanName, sourceName]));
const sourceNodes = new Map<string, THREE.Object3D>();
for (const sourceName of Object.keys(activeSourceMap)) {
  const node = source.scene.getObjectByName(sourceName);
  if (!node) throw new Error(`Missing source node ${sourceName}`);
  sourceNodes.set(sourceName, node);
}
target.scene.updateMatrixWorld(true);
source.scene.updateMatrixWorld(true);

const sides = ["left", "right"] as const;
const chainSuffixes = ["Shoulder", "UpperArm", "LowerArm"] as const;
const childSuffix = { Shoulder: "UpperArm", UpperArm: "LowerArm", LowerArm: "Hand" } as const;
const targetRestWorld = new Map<string, THREE.Quaternion>();
const targetRestDirection = new Map<string, THREE.Vector3>();
for (const side of sides) {
  for (const suffix of chainSuffixes) {
    const name = `${side}${suffix}`;
    const childName = `${side}${childSuffix[suffix]}`;
    const node = targetNodes.get(name)!;
    const child = targetNodes.get(childName)!;
    targetRestWorld.set(name, node.getWorldQuaternion(new THREE.Quaternion()));
    targetRestDirection.set(
      name,
      child.getWorldPosition(new THREE.Vector3()).sub(node.getWorldPosition(new THREE.Vector3())).normalize(),
    );
  }
}

const sourceSideForTarget = new Map<string, "left" | "right">();
for (const targetSide of sides) {
  const targetX = targetNodes.get(`${targetSide}Shoulder`)!.getWorldPosition(new THREE.Vector3()).x;
  const sourceLeftX = sourceNodes.get(sourceNameByHuman.get("leftShoulder")!)!.getWorldPosition(new THREE.Vector3()).x;
  const sourceRightX = sourceNodes.get(sourceNameByHuman.get("rightShoulder")!)!.getWorldPosition(new THREE.Vector3()).x;
  sourceSideForTarget.set(targetSide, Math.abs(targetX - sourceLeftX) <= Math.abs(targetX - sourceRightX) ? "left" : "right");
}

const outputs = new Map<string, Float32Array>();
const gestureSuffixes = [
  "Shoulder", "UpperArm", "LowerArm", "Hand",
  "ThumbMetacarpal", "ThumbProximal", "ThumbDistal",
  "IndexProximal", "IndexIntermediate", "IndexDistal",
  "MiddleProximal", "MiddleIntermediate", "MiddleDistal",
  "RingProximal", "RingIntermediate", "RingDistal",
  "LittleProximal", "LittleIntermediate", "LittleDistal",
] as const;
const activeSuffixes = sourceClipName === "Idle_Loop" ? chainSuffixes : gestureSuffixes;
for (const side of sides) for (const suffix of activeSuffixes) outputs.set(`${side}${suffix}`, new Float32Array(times.length * 4));

if (sourceClipName !== "Idle_Loop") {
  mixer.setTime(times[0]);
  targetMixer.setTime(times[0]);
  source.scene.updateMatrixWorld(true);
  target.scene.updateMatrixWorld(true);
  const sourceReferenceWorld = new Map<string, THREE.Quaternion>();
  const targetReferenceWorld = new Map<string, THREE.Quaternion>();
  for (const targetSide of sides) for (const suffix of gestureSuffixes) {
    const targetName = `${targetSide}${suffix}`;
    const sourceSide = sourceSideForTarget.get(targetSide)!;
    const sourceName = sourceNameByHuman.get(`${sourceSide}${suffix}`)!;
    sourceReferenceWorld.set(targetName, sourceNodes.get(sourceName)!.getWorldQuaternion(new THREE.Quaternion()));
    targetReferenceWorld.set(targetName, targetNodes.get(targetName)!.getWorldQuaternion(new THREE.Quaternion()));
  }
  const parentSuffix: Record<string, string | null> = {
    Shoulder: null, UpperArm: "Shoulder", LowerArm: "UpperArm", Hand: "LowerArm",
    ThumbMetacarpal: "Hand", ThumbProximal: "ThumbMetacarpal", ThumbDistal: "ThumbProximal",
    IndexProximal: "Hand", IndexIntermediate: "IndexProximal", IndexDistal: "IndexIntermediate",
    MiddleProximal: "Hand", MiddleIntermediate: "MiddleProximal", MiddleDistal: "MiddleIntermediate",
    RingProximal: "Hand", RingIntermediate: "RingProximal", RingDistal: "RingIntermediate",
    LittleProximal: "Hand", LittleIntermediate: "LittleProximal", LittleDistal: "LittleIntermediate",
  };
  for (let frame = 0; frame < times.length; frame += 1) {
    mixer.setTime(times[frame]);
    targetMixer.setTime(times[frame]);
    source.scene.updateMatrixWorld(true);
    target.scene.updateMatrixWorld(true);
    const desiredWorld = new Map<string, THREE.Quaternion>();
    for (const targetSide of sides) for (const suffix of gestureSuffixes) {
      const targetName = `${targetSide}${suffix}`;
      const sourceSide = sourceSideForTarget.get(targetSide)!;
      const sourceName = sourceNameByHuman.get(`${sourceSide}${suffix}`)!;
      const sourceWorld = sourceNodes.get(sourceName)!.getWorldQuaternion(new THREE.Quaternion());
      const delta = sourceWorld.multiply(sourceReferenceWorld.get(targetName)!.clone().invert());
      desiredWorld.set(targetName, delta.multiply(targetReferenceWorld.get(targetName)!));
    }
    for (const targetSide of sides) for (const suffix of gestureSuffixes) {
      const name = `${targetSide}${suffix}`;
      const parent = parentSuffix[suffix];
      const parentWorld = parent
        ? desiredWorld.get(`${targetSide}${parent}`)!
        : targetNodes.get(name)!.parent!.getWorldQuaternion(new THREE.Quaternion());
      parentWorld.clone().invert().multiply(desiredWorld.get(name)!).normalize().toArray(outputs.get(name)!, frame * 4);
    }
  }
} else for (let frame = 0; frame < times.length; frame += 1) {
  mixer.setTime(times[frame]);
  targetMixer.setTime(times[frame]);
  source.scene.updateMatrixWorld(true);
  target.scene.updateMatrixWorld(true);
  const desiredWorld = new Map<string, THREE.Quaternion>();
  for (const suffix of chainSuffixes) {
    for (const targetSide of sides) {
      const sourceSide = sourceSideForTarget.get(targetSide)!;
      const targetName = `${targetSide}${suffix}`;
      const sourceName = sourceNameByHuman.get(`${sourceSide}${suffix}`)!;
      const sourceChildName = sourceNameByHuman.get(`${sourceSide}${childSuffix[suffix]}`)!;
      const sourceNode = sourceNodes.get(sourceName)!;
      const sourceChild = sourceNodes.get(sourceChildName)!;
      const sourceDirection = sourceChild.getWorldPosition(new THREE.Vector3())
        .sub(sourceNode.getWorldPosition(new THREE.Vector3())).normalize();
      const swing = new THREE.Quaternion().setFromUnitVectors(targetRestDirection.get(targetName)!, sourceDirection);
      desiredWorld.set(targetName, swing.multiply(targetRestWorld.get(targetName)!));
    }
  }
  for (const suffix of chainSuffixes) {
    for (const targetSide of sides) {
      const name = `${targetSide}${suffix}`;
      const node = targetNodes.get(name)!;
      const parentName = suffix === "Shoulder" ? null : `${targetSide}${chainSuffixes[chainSuffixes.indexOf(suffix) - 1]}`;
      const parentWorld = parentName
        ? desiredWorld.get(parentName)!
        : node.parent!.getWorldQuaternion(new THREE.Quaternion());
      parentWorld.clone().invert().multiply(desiredWorld.get(name)!).normalize().toArray(outputs.get(name)!, frame * 4);
    }
  }
}
for (const values of outputs.values()) values.set(values.subarray(0, 4), values.length - 4);
replaceAnimationOutputs(targetDocument, outputs);
await writeFile(outputPath, packGlb(targetDocument.json, targetDocument.bin));
console.log(JSON.stringify({ outputPath, sourceSideForTarget: Object.fromEntries(sourceSideForTarget) }, null, 2));

function replaceAnimationOutputs(document: { json: Record<string, any>; bin: Buffer }, outputs: Map<string, Float32Array>) {
  const animation = document.json.animations.find((value) => value.name === targetClipName);
  for (const [humanName, values] of outputs) {
    const node = targetHumanBones?.[humanName]?.node ?? nodeIndexByName.get(targetBoneNameByHuman[humanName]);
    if (node === undefined) throw new Error(`Missing target animation node ${humanName}`);
    const channel = animation.channels.find((value) => value.target.node === node && value.target.path === "rotation");
    if (!channel) throw new Error(`Missing target animation channel ${humanName}`);
    const accessor = animation.samplers[channel.sampler].output;
    const view = document.json.bufferViews[document.json.accessors[accessor].bufferView];
    const byteOffset = (view.byteOffset ?? 0) + (document.json.accessors[accessor].byteOffset ?? 0);
    new Float32Array(document.bin.buffer, document.bin.byteOffset + byteOffset, values.length).set(values);
  }
}
function parseGlb(bytes: Buffer) {
  const jsonLength = bytes.readUInt32LE(12); const json = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString());
  const binHeader = 20 + jsonLength; const binLength = bytes.readUInt32LE(binHeader);
  return { json, bin: Buffer.from(bytes.subarray(binHeader + 8, binHeader + 8 + binLength)) };
}
function textureless(source: { json: Record<string, any>; bin: Buffer }) {
  const json = structuredClone(source.json);
  for (const value of json.materials ?? []) {
    if (value.pbrMetallicRoughness) {
      delete value.pbrMetallicRoughness.baseColorTexture;
      delete value.pbrMetallicRoughness.metallicRoughnessTexture;
    }
    delete value.normalTexture;
    delete value.occlusionTexture;
    delete value.emissiveTexture;
  }
  return { json, bin: source.bin };
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
