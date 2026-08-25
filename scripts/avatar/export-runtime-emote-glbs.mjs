import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { prune } from "@gltf-transform/functions";

const inputPath = "public/animations/idle.glb";
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);

function stripNonAnimationResources(document) {
  const root = document.getRoot();
  root.listMeshes().forEach((resource) => resource.dispose());
  root.listSkins().forEach((resource) => resource.dispose());
  root.listMaterials().forEach((resource) => resource.dispose());
  root.listTextures().forEach((resource) => resource.dispose());
  root.listCameras().forEach((resource) => resource.dispose());
}

function retainAnimationTracks(document, keepTrack) {
  for (const animation of document.getRoot().listAnimations()) {
    for (const channel of [...animation.listChannels()]) {
      const nodeName = channel.getTargetNode()?.getName() ?? "";
      const targetPath = channel.getTargetPath() ?? "";
      if (!keepTrack(nodeName, targetPath)) channel.dispose();
    }
    for (const sampler of [...animation.listSamplers()]) {
      if (sampler.listParents().length <= 1) sampler.dispose();
    }
  }
}

const multiplyQuaternion = ([ax, ay, az, aw], [bx, by, bz, bw]) => [
  aw * bx + ax * bw + ay * bz - az * by,
  aw * by - ax * bz + ay * bw + az * bx,
  aw * bz + ax * by - ay * bx + az * bw,
  aw * bw - ax * bx - ay * by - az * bz,
];

const axisQuaternion = (axis, degrees) => {
  const half = degrees * Math.PI / 360;
  const sine = Math.sin(half);
  return axis === "x" ? [sine, 0, 0, Math.cos(half)] : [0, sine, 0, Math.cos(half)];
};

async function exportEmote({ outputPath, animationName, times, headDegrees, neckDegrees, axis }) {
  const document = await io.read(inputPath);
  const root = document.getRoot();
  const idle = root.listAnimations().find((animation) => animation.getName() === "Idle_Loop");
  if (!idle) throw new Error("Idle_Loop was not found");
  const sourceChannels = idle.listChannels();
  root.listAnimations().forEach((animation) => animation.dispose());
  const animation = document.createAnimation(animationName);

  for (const sourceChannel of sourceChannels) {
    const sourceSampler = sourceChannel.getSampler();
    const sourceOutput = sourceSampler.getOutput();
    const targetNode = sourceChannel.getTargetNode();
    const targetPath = sourceChannel.getTargetPath();
    if (!sourceOutput || !targetNode || !targetPath) continue;
    if (targetPath !== "rotation" || (targetNode.getName() !== "Head" && targetNode.getName() !== "neck")) continue;
    const valueSize = sourceOutput.getElementSize();
    const base = Array.from(sourceOutput.getArray().slice(0, valueSize));
    const values = [];

    for (let index = 0; index < times.length; index += 1) {
      if (targetPath === "rotation" && targetNode.getName() === "Head") {
        values.push(...multiplyQuaternion(base, axisQuaternion(axis, headDegrees[index])));
      } else if (targetPath === "rotation" && targetNode.getName() === "neck") {
        values.push(...multiplyQuaternion(base, axisQuaternion(axis, neckDegrees[index])));
      } else {
        values.push(...base);
      }
    }

    const input = document.createAccessor().setType("SCALAR").setArray(new Float32Array(times));
    const output = document.createAccessor().setType(sourceOutput.getType()).setArray(new Float32Array(values));
    const sampler = document.createAnimationSampler().setInput(input).setOutput(output).setInterpolation("LINEAR");
    const channel = document.createAnimationChannel().setSampler(sampler).setTargetNode(targetNode).setTargetPath(targetPath);
    animation.addSampler(sampler).addChannel(channel);
  }

  stripNonAnimationResources(document);
  await document.transform(prune());
  await io.write(outputPath, document);
  console.log(`${animationName}: ${outputPath} (${animation.listChannels().length} channels, ${times.at(-1)}s)`);
}

async function stripExistingEmote(outputPath) {
  const document = await io.read(outputPath);
  retainAnimationTracks(document, (nodeName, targetPath) => (
    targetPath === "rotation"
    && /^Left(?:Shoulder|Arm|ForeArm|Hand|Thumb\d*|Index\d*|Middle\d*|Ring\d*|Pinky\d*)$/.test(nodeName)
  ));
  stripNonAnimationResources(document);
  await document.transform(prune());
  await io.write(outputPath, document);
  console.log(`animation-only: ${outputPath}`);
}

await exportEmote({
  outputPath: "public/animations/nod-smile.glb",
  animationName: "nod_smile",
  times: [0, 0.35, 0.7, 1.05, 1.4, 1.75, 2],
  headDegrees: [0, -4, 6, -3, 4, -2, 0],
  neckDegrees: [0, -1.5, 2, -1, 1.5, -0.75, 0],
  axis: "x",
});

await exportEmote({
  outputPath: "public/animations/head-shake-disappointed.glb",
  animationName: "head_shake_disappointed",
  times: [0, 0.3, 0.65, 1, 1.35, 1.7, 2],
  headDegrees: [0, -7.5, 9, -8, 6, -3, 0],
  neckDegrees: [0, -2.5, 3, -2.5, 2, -1, 0],
  axis: "y",
});

await stripExistingEmote("public/animations/wave-hello-review-v2.glb");
