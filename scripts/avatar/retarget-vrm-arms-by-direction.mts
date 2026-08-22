import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { sourceBoneToHumanBone } from "../../src/components/avatar-view/vrm-animation/VrmAnimationContract";

const targetPath = path.resolve(process.argv[2] ?? "public/models/yuyang-avatar-vrm1-idle-embedded-review.glb");
const libraryPath = path.resolve(process.argv[3] ?? "public/models/quaternius-vrm-animation-library.glb");
const outputPath = path.resolve(process.argv[4] ?? "public/models/yuyang-avatar-vrm1-idle-direction-arms-review.glb");
globalThis.ProgressEvent ??= class ProgressEvent extends Event {} as typeof ProgressEvent;

const targetDocument = parseGlb(await readFile(targetPath));
const libraryBytes = await readFile(libraryPath);
const [target, source] = await Promise.all([
  new GLTFLoader().parseAsync(toArrayBuffer(packGlb(textureless(targetDocument).json, targetDocument.bin)), ""),
  new GLTFLoader().parseAsync(toArrayBuffer(libraryBytes), ""),
]);
const clip = source.animations.find((value) => value.name === "Idle_Loop");
if (!clip) throw new Error("Animation library is missing Idle_Loop");
const times = Array.from(clip.tracks[0]?.times ?? []);
const mixer = new THREE.AnimationMixer(source.scene);
mixer.clipAction(clip).play();
const targetClip = target.animations.find((value) => value.name === "Idle_Loop");
if (!targetClip) throw new Error("Target GLB is missing Idle_Loop");
const targetMixer = new THREE.AnimationMixer(target.scene);
targetMixer.clipAction(targetClip).play();

const targetHumanBones = targetDocument.json.extensions.VRMC_vrm.humanoid.humanBones as Record<string, { node: number }>;
const targetNodes = new Map<string, THREE.Object3D>();
for (const [humanName, entry] of Object.entries(targetHumanBones)) {
  const nodeName = targetDocument.json.nodes[entry.node].name;
  const node = target.scene.getObjectByName(nodeName);
  if (!node) throw new Error(`Missing target node ${humanName}: ${nodeName}`);
  targetNodes.set(humanName, node);
}
const sourceNameByHuman = new Map(Object.entries(sourceBoneToHumanBone).map(([sourceName, humanName]) => [humanName, sourceName]));
const sourceNodes = new Map<string, THREE.Object3D>();
for (const sourceName of Object.keys(sourceBoneToHumanBone)) {
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
for (const side of sides) for (const suffix of chainSuffixes) outputs.set(`${side}${suffix}`, new Float32Array(times.length * 4));
for (let frame = 0; frame < times.length; frame += 1) {
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
  const animation = document.json.animations.find((value) => value.name === "Idle_Loop");
  for (const [humanName, values] of outputs) {
    const node = targetHumanBones[humanName].node;
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
  for (const value of json.materials ?? []) { if (value.pbrMetallicRoughness) delete value.pbrMetallicRoughness.baseColorTexture; delete value.normalTexture; }
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
