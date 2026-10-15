import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import type { SanDiegoDistrictView } from "@/agent/context/camera-views";
import { createSanDiegoPopulation, validateSanDiegoPopulation } from "./population";
import { prepareSanDiegoScene } from "./scene-resources";
import { disposeSceneObjects } from "../runtime/dispose-runtime";

export type SanDiegoLandmarkId = "westview-high-school" | "torrey-highlands-plaza" | "mesa-verde-middle-school" | "deer-canyon-elementary-school";
// Match GLTFLoader's node-name normalization. Flat regional layers must never
// become shadow casters: their long triangles create wedges across the ocean.
const REGIONAL_SHADOW_CASTERS = new Set([
  "Regional buildings",
  "District buildings",
  "Coastal pines and canyon trees",
  "Park Village canyon waterfall",
].map((name) => THREE.PropertyBinding.sanitizeNodeName(name)));
export interface SanDiegoCamera {
  target: [number, number, number];
  azimuth?: number;
  height: number;
  radius: number;
  zoom: number;
}
export interface SanDiegoBounds {
  min: [number, number, number];
  max: [number, number, number];
}
export interface SanDiegoDistrict {
  id: SanDiegoDistrictView;
  label: string;
  markerPosition: [number, number, number];
  camera: SanDiegoCamera;
  bounds: SanDiegoBounds;
}
export interface SanDiegoAnnotation {
  label: string;
  view: SanDiegoDistrictView;
  position: [number, number, number];
}
interface ModelManifest {
  modelUrl: string;
  contentHash: string;
  attribution: string;
  overview: SanDiegoCamera;
}
interface SanDiegoManifest extends ModelManifest {
  landmarks: { cameraViewId: SanDiegoLandmarkId; rootName: string }[];
}
interface RegionManifest extends ModelManifest {
  originalModel: Pick<ModelManifest, "modelUrl" | "contentHash">;
  bounds: SanDiegoBounds;
  coverageBounds?: SanDiegoBounds;
  peripheralGeometryBounds?: SanDiegoBounds;
  districts: SanDiegoDistrict[];
  annotations?: SanDiegoAnnotation[];
}
export interface SanDiegoScene {
  group: THREE.Group;
  landmarks: { cameraViewId: SanDiegoLandmarkId; root: THREE.Mesh }[];
  overview: SanDiegoCamera;
  bounds: SanDiegoBounds;
  coverageBounds: SanDiegoBounds;
  transitionCoverageBounds: SanDiegoBounds;
  districts: SanDiegoDistrict[];
  annotations: SanDiegoAnnotation[];
  attribution: string;
  createPopulation: (isVisible: () => boolean, revealAt: () => number) => ReturnType<typeof createSanDiegoPopulation>;
}

function disposeGroup(group: THREE.Group) {
  disposeSceneObjects([group]);
}

async function loadManifest<T extends ModelManifest>(url: string, signal?: AbortSignal): Promise<T> {
  // Mutable manifests revalidate; only their content-addressed GLBs cache long-term.
  const response = await fetch(url, { signal, cache: "no-cache" });
  if (!response.ok) throw new Error(`San Diego manifest failed (${response.status})`);
  return response.json() as Promise<T>;
}

async function loadModel(manifest: ModelManifest, signal?: AbortSignal) {
  const response = await fetch(`${manifest.modelUrl}?v=${manifest.contentHash.slice(0, 12)}`, { signal });
  if (!response.ok) throw new Error(`San Diego scene failed (${response.status})`);
  const data = await response.arrayBuffer();
  signal?.throwIfAborted();
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  const { scene } = await loader.parseAsync(data, "/models/san-diego/");
  if (signal?.aborted) {
    disposeGroup(scene);
    signal.throwIfAborted();
  }
  return scene;
}

/** Load both local scales atomically; no live geographic service is contacted. */
export async function loadSanDiegoScene({ signal }: { signal?: AbortSignal } = {}): Promise<SanDiegoScene> {
  const [manifest, region] = await Promise.all([
    loadManifest<SanDiegoManifest>("/data/san-diego/manifest.json", signal),
    loadManifest<RegionManifest>("/data/san-diego/region-manifest.json", signal),
  ]);
  const expectedDistricts = ["torrey-highlands", "torrey-pines", "park-village"];
  validateSanDiegoPopulation(manifest.contentHash);
  if (region.originalModel.contentHash !== manifest.contentHash || region.originalModel.modelUrl !== manifest.modelUrl) {
    throw new Error("San Diego region is stale. Regenerate data:san-diego-region for the current Torrey Highlands model.");
  }
  if (region.districts.length !== expectedDistricts.length
    || expectedDistricts.some((id) => !region.districts.some((district) => district.id === id))) {
    throw new Error("San Diego region requires all three districts");
  }
  // allSettled lets us dispose any successful half when its partner fails or aborts.
  const models = await Promise.allSettled([loadModel(manifest, signal), loadModel(region, signal)]);
  const group = new THREE.Group();
  group.name = "San Diego · coast and canyon districts";
  models.forEach((model, index) => {
    if (model.status !== "fulfilled") return;
    model.value.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      object.castShadow = index === 0
        ? object.name !== "terrain" // Preserve the original Torrey Highlands policy.
        : REGIONAL_SHADOW_CASTERS.has(object.name);
      object.receiveShadow = true;
    });
    group.add(model.value);
  });
  try {
    const failure = models.find((model) => model.status === "rejected");
    if (failure?.status === "rejected") throw failure.reason;
    signal?.throwIfAborted();
    const original = models[0];
    if (original.status !== "fulfilled") throw new Error("Torrey Highlands did not load");
    const landmarks = manifest.landmarks.map(({ cameraViewId, rootName }) => {
      let root: THREE.Mesh | undefined;
      group.traverse((object) => {
        if (object instanceof THREE.Mesh && object.userData.cameraViewId === cameraViewId) root = object;
      });
      if (!root) throw new Error(`Missing merged San Diego landmark: ${rootName}`);
      root.name = rootName;
      root.matrixAutoUpdate = true;
      return { cameraViewId, root };
    });
    const expectedLandmarks: SanDiegoLandmarkId[] = ["westview-high-school", "torrey-highlands-plaza", "mesa-verde-middle-school", "deer-canyon-elementary-school"];
    if (landmarks.length !== 4 || new Set(landmarks.map(({ root }) => root)).size !== 4
      || expectedLandmarks.some((id) => !landmarks.some(({ cameraViewId }) => cameraViewId === id))) {
      throw new Error("San Diego scene requires all four unique landmark roots");
    }
    // Keep the main-dev model's roads, transforms, material policy and camera intact.
    prepareSanDiegoScene(original.value, landmarks.map(({ root }) => root));
    const regional = models[1];
    if (regional.status === "fulfilled") prepareSanDiegoScene(regional.value, [], (mesh) => REGIONAL_SHADOW_CASTERS.has(mesh.name));
    group.updateMatrix();
    group.matrixAutoUpdate = false;
    return {
      group,
      landmarks,
      overview: region.overview,
      bounds: region.bounds,
      // Older manifests used these same source limits as their overview bounds.
      coverageBounds: region.coverageBounds ?? region.bounds,
      transitionCoverageBounds: region.peripheralGeometryBounds ?? region.coverageBounds ?? region.bounds,
      // The original overview is the authoritative Torrey Highlands camera.
      districts: region.districts.map((district) => district.id === "torrey-highlands"
        ? { ...district, camera: manifest.overview }
        : district),
      annotations: region.annotations ?? [],
      attribution: region.attribution,
      createPopulation: (isVisible, revealAt) => createSanDiegoPopulation(original.value, isVisible, revealAt),
    };
  } catch (error) {
    disposeGroup(group);
    throw error;
  }
}
