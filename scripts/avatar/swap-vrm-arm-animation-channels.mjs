import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const inputPath = path.resolve(process.argv[2] ?? "");
const outputPath = path.resolve(process.argv[3] ?? "");
if (!inputPath || !outputPath) {
  throw new Error("Usage: swap-vrm-arm-animation-channels.mjs <input.glb> <output.glb>");
}

const source = await readFile(inputPath);
const jsonLength = source.readUInt32LE(12);
const json = JSON.parse(source.subarray(20, 20 + jsonLength).toString("utf8"));
const bones = json.extensions?.VRMC_vrm?.humanoid?.humanBones;
const animation = json.animations?.[0];
if (!bones || !animation) throw new Error("VRM humanoid or animation is missing");

const suffixes = [
  "Shoulder",
  "UpperArm",
  "LowerArm",
  "Hand",
  "ThumbMetacarpal",
  "ThumbProximal",
  "ThumbDistal",
  "IndexProximal",
  "IndexIntermediate",
  "IndexDistal",
  "MiddleProximal",
  "MiddleIntermediate",
  "MiddleDistal",
  "RingProximal",
  "RingIntermediate",
  "RingDistal",
  "LittleProximal",
  "LittleIntermediate",
  "LittleDistal",
];
const swap = new Map();
for (const suffix of suffixes) {
  const left = bones[`left${suffix}`]?.node;
  const right = bones[`right${suffix}`]?.node;
  if (left === undefined || right === undefined) throw new Error(`Missing arm pair ${suffix}`);
  swap.set(left, right);
  swap.set(right, left);
}
for (const channel of animation.channels) {
  if (channel.target.path === "rotation" && swap.has(channel.target.node)) {
    channel.target.node = swap.get(channel.target.node);
  }
}

let jsonBytes = Buffer.from(JSON.stringify(json));
const padding = (4 - (jsonBytes.length % 4)) % 4;
if (padding) jsonBytes = Buffer.concat([jsonBytes, Buffer.alloc(padding, 0x20)]);
const remaining = source.subarray(20 + jsonLength);
const output = Buffer.alloc(20 + jsonBytes.length + remaining.length);
output.write("glTF", 0, "ascii");
output.writeUInt32LE(2, 4);
output.writeUInt32LE(output.length, 8);
output.writeUInt32LE(jsonBytes.length, 12);
output.write("JSON", 16, "ascii");
jsonBytes.copy(output, 20);
remaining.copy(output, 20 + jsonBytes.length);
await writeFile(outputPath, output);
console.log(`Wrote arm-channel-swapped GLB: ${outputPath}`);
