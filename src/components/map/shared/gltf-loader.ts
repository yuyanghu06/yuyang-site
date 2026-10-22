import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";

export async function loadGlb(url: string, signal: AbortSignal) {
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`${url} failed (${response.status})`);
  const buffer = await response.arrayBuffer();
  return new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(buffer, "");
}

export function replaceMeshMaterials(root: THREE.Object3D, replacement: THREE.Material) {
  const replacedMaterials = new Set<THREE.Material>();
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      replacedMaterials.add(material);
    }
    object.material = replacement;
  });
  // A GLB may share materials/textures with lines, points or the replacement.
  // Retain those resources; only release materials no drawable still uses.
  const retainedTextures = new Set<THREE.Texture>();
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh || object instanceof THREE.Line || object instanceof THREE.Points || object instanceof THREE.Sprite)) return;
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      replacedMaterials.delete(material);
      for (const value of Object.values(material)) {
        if (value instanceof THREE.Texture) retainedTextures.add(value);
      }
    }
  });
  const disposedTextures = new Set<THREE.Texture>();
  for (const material of replacedMaterials) {
    for (const value of Object.values(material)) {
      if (!(value instanceof THREE.Texture) || retainedTextures.has(value) || disposedTextures.has(value)) continue;
      disposedTextures.add(value);
      value.dispose();
    }
    material.dispose();
  }
}
