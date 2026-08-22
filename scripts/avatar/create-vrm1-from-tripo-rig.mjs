import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const inputPath = path.resolve(
  process.argv[2] ?? "public/models/yuyang-avatar-tripo-quad-50k-tripo-rig-review.glb",
);
const outputPath = path.resolve(
  process.argv[3] ?? "public/models/yuyang-avatar-vrm1-review.vrm",
);

const humanBones = {
  hips: 51,
  spine: 42,
  chest: 41,
  upperChest: 40,
  neck: 1,
  head: 0,
  leftShoulder: 39,
  leftUpperArm: 38,
  leftLowerArm: 37,
  leftHand: 36,
  leftThumbMetacarpal: 23,
  leftThumbProximal: 22,
  leftThumbDistal: 21,
  leftIndexProximal: 26,
  leftIndexIntermediate: 25,
  leftIndexDistal: 24,
  leftMiddleProximal: 29,
  leftMiddleIntermediate: 28,
  leftMiddleDistal: 27,
  leftRingProximal: 32,
  leftRingIntermediate: 31,
  leftRingDistal: 30,
  leftLittleProximal: 35,
  leftLittleIntermediate: 34,
  leftLittleDistal: 33,
  rightShoulder: 20,
  rightUpperArm: 19,
  rightLowerArm: 18,
  rightHand: 17,
  rightThumbMetacarpal: 4,
  rightThumbProximal: 3,
  rightThumbDistal: 2,
  rightIndexProximal: 7,
  rightIndexIntermediate: 6,
  rightIndexDistal: 5,
  rightMiddleProximal: 10,
  rightMiddleIntermediate: 9,
  rightMiddleDistal: 8,
  rightRingProximal: 13,
  rightRingIntermediate: 12,
  rightRingDistal: 11,
  rightLittleProximal: 16,
  rightLittleIntermediate: 15,
  rightLittleDistal: 14,
  leftUpperLeg: 46,
  leftLowerLeg: 45,
  leftFoot: 44,
  leftToes: 43,
  rightUpperLeg: 50,
  rightLowerLeg: 49,
  rightFoot: 48,
  rightToes: 47,
};

if (process.env.YUYANG_VRM_ORIGINAL_ARM_SIDES === "1") {
  Object.assign(humanBones, {
    leftShoulder: 20,
    leftUpperArm: 19,
    leftLowerArm: 18,
    leftHand: 17,
    leftThumbMetacarpal: 4,
    leftThumbProximal: 3,
    leftThumbDistal: 2,
    leftIndexProximal: 7,
    leftIndexIntermediate: 6,
    leftIndexDistal: 5,
    leftMiddleProximal: 10,
    leftMiddleIntermediate: 9,
    leftMiddleDistal: 8,
    leftRingProximal: 13,
    leftRingIntermediate: 12,
    leftRingDistal: 11,
    leftLittleProximal: 16,
    leftLittleIntermediate: 15,
    leftLittleDistal: 14,
    rightShoulder: 39,
    rightUpperArm: 38,
    rightLowerArm: 37,
    rightHand: 36,
    rightThumbMetacarpal: 23,
    rightThumbProximal: 22,
    rightThumbDistal: 21,
    rightIndexProximal: 26,
    rightIndexIntermediate: 25,
    rightIndexDistal: 24,
    rightMiddleProximal: 29,
    rightMiddleIntermediate: 28,
    rightMiddleDistal: 27,
    rightRingProximal: 32,
    rightRingIntermediate: 31,
    rightRingDistal: 30,
    rightLittleProximal: 35,
    rightLittleIntermediate: 34,
    rightLittleDistal: 33,
  });
}

const targetNodeNames = {
  hips: "Hips",
  spine: "Spine02",
  chest: "Spine01",
  upperChest: "Spine",
  neck: "neck",
  head: "Head",
  leftShoulder: "LeftShoulder",
  leftUpperArm: "LeftArm",
  leftLowerArm: "LeftForeArm",
  leftHand: "LeftHand",
  rightShoulder: "RightShoulder",
  rightUpperArm: "RightArm",
  rightLowerArm: "RightForeArm",
  rightHand: "RightHand",
  leftUpperLeg: "LeftUpLeg",
  leftLowerLeg: "LeftLeg",
  leftFoot: "LeftFoot",
  leftToes: "LeftToeBase",
  rightUpperLeg: "RightUpLeg",
  rightLowerLeg: "RightLeg",
  rightFoot: "RightFoot",
  rightToes: "RightToeBase",
};

for (const side of ["left", "right"]) {
  const prefix = side === "left" ? "Left" : "Right";
  for (const [vrmDigit, localDigit] of [
    ["Thumb", "Thumb"],
    ["Index", "Index"],
    ["Middle", "Middle"],
    ["Ring", "Ring"],
    ["Little", "Pinky"],
  ]) {
    const stages =
      vrmDigit === "Thumb"
        ? ["Metacarpal", "Proximal", "Distal"]
        : ["Proximal", "Intermediate", "Distal"];
    stages.forEach((stage, index) => {
      targetNodeNames[`${side}${vrmDigit}${stage}`] = `${prefix}${localDigit}${index + 1}`;
    });
  }
}

const source = await readFile(inputPath);
if (source.toString("ascii", 0, 4) !== "glTF") {
  throw new Error(`Not a binary glTF file: ${inputPath}`);
}

const jsonLength = source.readUInt32LE(12);
const jsonType = source.toString("ascii", 16, 20);
if (jsonType !== "JSON") throw new Error("The first GLB chunk is not JSON");
const document = JSON.parse(source.subarray(20, 20 + jsonLength).toString("utf8"));

for (const [humanBone, node] of Object.entries(humanBones)) {
  if (!document.nodes?.[node]) {
    throw new Error(`Missing node ${node} required for VRM bone ${humanBone}`);
  }
  const targetName = targetNodeNames[humanBone];
  if (targetName) document.nodes[node].name = targetName;
}

document.extensionsUsed = Array.from(
  new Set([...(document.extensionsUsed ?? []), "VRMC_vrm"]),
);
document.extensions = {
  ...(document.extensions ?? {}),
  VRMC_vrm: {
    specVersion: "1.0",
    meta: {
      name: "Yuyang Avatar VRM Rig Review",
      version: "1.0",
      authors: ["Yuyang"],
      licenseUrl: "https://vrm.dev/licenses/1.0/",
      avatarPermission: "onlyAuthor",
      allowExcessivelyViolentUsage: false,
      allowExcessivelySexualUsage: false,
      commercialUsage: "personalNonProfit",
      allowPoliticalOrReligiousUsage: false,
      allowAntisocialOrHateUsage: false,
      creditNotation: "required",
      allowRedistribution: false,
      modification: "prohibited",
    },
    humanoid: {
      humanBones: Object.fromEntries(
        Object.entries(humanBones).map(([name, node]) => [name, { node }]),
      ),
    },
    firstPerson: {
      meshAnnotations: [{ node: 52, type: "both" }],
    },
    lookAt: {
      offsetFromHeadBone: [0, 0.04, 0],
      type: "bone",
    },
    expressions: { preset: {}, custom: {} },
  },
};

let json = Buffer.from(JSON.stringify(document));
const padding = (4 - (json.length % 4)) % 4;
if (padding) json = Buffer.concat([json, Buffer.alloc(padding, 0x20)]);

const remainingChunks = source.subarray(20 + jsonLength);
const result = Buffer.alloc(20 + json.length + remainingChunks.length);
result.write("glTF", 0, "ascii");
result.writeUInt32LE(2, 4);
result.writeUInt32LE(result.length, 8);
result.writeUInt32LE(json.length, 12);
result.write("JSON", 16, "ascii");
json.copy(result, 20);
remainingChunks.copy(result, 20 + json.length);

await writeFile(outputPath, result);
console.log(`Wrote VRM 1.0 review avatar: ${outputPath}`);
