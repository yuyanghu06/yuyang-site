import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const inputPath = path.resolve(process.argv[2] ?? "");
const animationName = process.argv[3];
const outputPath = path.resolve(process.argv[4] ?? "");
if (!inputPath || !animationName || !outputPath) {
  throw new Error("Usage: extract-glb-animation.mjs <input.glb> <animation-name> <output.glb>");
}

const source = await readFile(inputPath);
if (source.toString("ascii", 0, 4) !== "glTF") throw new Error("Input is not GLB");
const jsonLength = source.readUInt32LE(12);
const json = JSON.parse(source.subarray(20, 20 + jsonLength).toString("utf8"));
const animation = json.animations?.find((candidate) => candidate.name === animationName);
if (!animation) throw new Error(`Animation not found: ${animationName}`);
json.animations = [animation];

let jsonBytes = Buffer.from(JSON.stringify(json));
const padding = (4 - (jsonBytes.length % 4)) % 4;
if (padding) jsonBytes = Buffer.concat([jsonBytes, Buffer.alloc(padding, 0x20)]);
const remainingChunks = source.subarray(20 + jsonLength);
const output = Buffer.alloc(20 + jsonBytes.length + remainingChunks.length);
output.write("glTF", 0, "ascii");
output.writeUInt32LE(2, 4);
output.writeUInt32LE(output.length, 8);
output.writeUInt32LE(jsonBytes.length, 12);
output.write("JSON", 16, "ascii");
jsonBytes.copy(output, 20);
remainingChunks.copy(output, 20 + jsonBytes.length);
await writeFile(outputPath, output);
console.log(`Wrote ${animationName}: ${outputPath}`);
