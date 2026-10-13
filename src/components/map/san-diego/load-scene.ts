import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";

export type SanDiegoLandmarkId = "westview-high-school" | "torrey-highlands-plaza";

interface SanDiegoManifest {
  modelUrl: string;
  contentHash: string;
  attribution: string;
  overview: { target: [number, number, number]; height: number; radius: number; zoom: number };
  landmarks: { cameraViewId: SanDiegoLandmarkId; rootName: string }[];
}

export interface SanDiegoScene {
  group: THREE.Group;
  landmarks: { cameraViewId: SanDiegoLandmarkId; root: THREE.Mesh }[];
  overview: SanDiegoManifest["overview"];
  attribution: string;
}

function disposeGroup(group: THREE.Group) {
  const materials = new Set<THREE.Material>();
  group.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    object.geometry.dispose();
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) materials.add(material);
  });
  materials.forEach((material) => material.dispose());
}

/** Load the generated local scene; no live map service is contacted. */
export async function loadSanDiegoScene({ signal }: { signal?: AbortSignal } = {}): Promise<SanDiegoScene> {
  // The manifest is mutable; revalidate it even when /data/ has long-lived
  // browser cache headers. Its content hash keeps the large GLB cacheable.
  const manifestResponse = await fetch("/data/san-diego/manifest.json", { signal, cache: "no-cache" });
  if (!manifestResponse.ok) throw new Error(`San Diego manifest failed (${manifestResponse.status})`);
  const manifest = await manifestResponse.json() as SanDiegoManifest;
  const modelResponse = await fetch(`${manifest.modelUrl}?v=${manifest.contentHash.slice(0, 12)}`, { signal });
  if (!modelResponse.ok) throw new Error(`San Diego scene failed (${modelResponse.status})`);
  const data = await modelResponse.arrayBuffer();
  signal?.throwIfAborted();
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  const gltf = await loader.parseAsync(data, "/models/san-diego/");
  const group = gltf.scene;
  try {
    signal?.throwIfAborted();
    group.name = "San Diego · Torrey Highlands";
    group.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      object.castShadow = object.name !== "terrain";
      object.receiveShadow = true;
    });
    const landmarks = manifest.landmarks.map(({ cameraViewId, rootName }) => {
      // GLTFLoader sanitizes whitespace; userData survives export unchanged.
      let root: THREE.Mesh | undefined;
      group.traverse((object) => {
        if (object instanceof THREE.Mesh && object.userData.cameraViewId === cameraViewId) root = object;
      });
      if (!root) throw new Error(`Missing merged San Diego landmark: ${rootName}`);
      root.name = rootName;
      root.matrixAutoUpdate = true;
      return { cameraViewId, root };
    });
    if (landmarks.length !== 2) throw new Error("San Diego scene requires both landmark roots");
    return { group, landmarks, overview: manifest.overview, attribution: manifest.attribution };
  } catch (error) {
    disposeGroup(group);
    throw error;
  }
}
