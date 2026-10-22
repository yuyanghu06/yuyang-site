import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import type { SanDiegoDistrictView } from "@/agent/context/camera-views";
import type { createSanDiegoPopulation } from "./population";
import { createSanDiegoLod } from "./scene-lod";
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
interface ModelReference {
  modelUrl: string;
  contentHash: string;
}
interface ModelManifest extends ModelReference {
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
interface OverviewManifest extends ModelReference {
  originalModel: ModelReference;
  regionalModel: ModelReference;
}
export type SanDiegoDetail = {
  kind: "original";
  group: THREE.Group;
  landmarks: { cameraViewId: SanDiegoLandmarkId; root: THREE.Mesh }[];
  createPopulation: (isVisible: () => boolean, revealAt: () => number) => ReturnType<typeof createSanDiegoPopulation>;
} | { kind: "region"; group: THREE.Group };
export interface SanDiegoScene {
  group: THREE.Group;
  lod: ReturnType<typeof createSanDiegoLod<SanDiegoDetail>>;
  overview: SanDiegoCamera;
  bounds: SanDiegoBounds;
  coverageBounds: SanDiegoBounds;
  transitionCoverageBounds: SanDiegoBounds;
  districts: SanDiegoDistrict[];
  annotations: SanDiegoAnnotation[];
  attribution: string;
}

function disposeGroup(group: THREE.Group) {
  disposeSceneObjects([group]);
}

async function loadManifest<T extends ModelReference>(url: string, signal?: AbortSignal): Promise<T> {
  // Mutable manifests revalidate; only their content-addressed GLBs cache long-term.
  const response = await fetch(url, { signal, cache: "no-cache" });
  if (!response.ok) throw new Error(`San Diego manifest failed (${response.status})`);
  return response.json() as Promise<T>;
}

async function loadModel(manifest: ModelReference, signal?: AbortSignal) {
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

/** Overview is the only geometry decoded on city entry; district source GLBs remain untouched. */
export async function loadSanDiegoScene({ signal }: { signal?: AbortSignal } = {}): Promise<SanDiegoScene> {
  const [manifest, region, overview] = await Promise.all([
    loadManifest<SanDiegoManifest>("/data/san-diego/manifest.json", signal),
    loadManifest<RegionManifest>("/data/san-diego/region-manifest.json", signal),
    loadManifest<OverviewManifest>("/data/san-diego/overview-manifest.json", signal),
  ]);
  const matches = (a: ModelReference, b: ModelReference) => a.contentHash === b.contentHash && a.modelUrl === b.modelUrl;
  if (!matches(region.originalModel, manifest)) {
    throw new Error("San Diego region is stale. Regenerate data:san-diego-region for the current Torrey Highlands model.");
  }
  if (!matches(overview.originalModel, manifest) || !matches(overview.regionalModel, region)) {
    throw new Error("San Diego overview is stale. Regenerate data:san-diego-overview for the current source models.");
  }
  const expectedDistricts = ["torrey-highlands", "torrey-pines", "park-village"];
  if (region.districts.length !== expectedDistricts.length
    || expectedDistricts.some((id) => !region.districts.some((district) => district.id === id))) {
    throw new Error("San Diego region requires all three districts");
  }
  const overviewGroup = await loadModel(overview, signal);
  const group = new THREE.Group();
  group.name = "San Diego · coast and canyon districts";
  group.add(overviewGroup);
  try {
    signal?.throwIfAborted();
    const overviewOriginal = overviewGroup.getObjectByName("overview-original");
    const overviewRegion = overviewGroup.getObjectByName("overview-region");
    if (!overviewOriginal || !overviewRegion) throw new Error("San Diego overview requires both independent source layers");
    // Overview never casts shadows, even when retained as distant district surroundings.
    prepareSanDiegoScene(overviewGroup, [], () => false);
    group.updateMatrix();
    group.matrixAutoUpdate = false;
    const lod = createSanDiegoLod<SanDiegoDetail>({
      group, overviewOriginal, overviewRegion,
      load: async (kind, detailSignal) => {
        if (kind === "region") {
          const regional = await loadModel(region, detailSignal);
          try {
            prepareSanDiegoScene(regional, [], (mesh) => REGIONAL_SHADOW_CASTERS.has(mesh.name));
            return { kind, group: regional };
          } catch (error) { disposeGroup(regional); throw error; }
        }
        // Frozen spawn tables and shared instancing code are not needed by the overview.
        const { createSanDiegoPopulation, validateSanDiegoPopulation } = await import("./population");
        detailSignal.throwIfAborted();
        validateSanDiegoPopulation(manifest.contentHash);
        const original = await loadModel(manifest, detailSignal);
        try {
          const landmarks = manifest.landmarks.map(({ cameraViewId, rootName }) => {
            let root: THREE.Mesh | undefined;
            original.traverse((object) => {
              if (object instanceof THREE.Mesh && object.userData.cameraViewId === cameraViewId) root = object;
            });
            if (!root) throw new Error(`Missing merged San Diego landmark: ${rootName}`);
            root.name = rootName;
            return { cameraViewId, root };
          });
          const expectedLandmarks: SanDiegoLandmarkId[] = ["westview-high-school", "torrey-highlands-plaza", "mesa-verde-middle-school", "deer-canyon-elementary-school"];
          if (landmarks.length !== 4 || new Set(landmarks.map(({ root }) => root)).size !== 4
            || expectedLandmarks.some((id) => !landmarks.some(({ cameraViewId }) => cameraViewId === id))) {
            throw new Error("San Diego scene requires all four unique landmark roots");
          }
          prepareSanDiegoScene(original, landmarks.map(({ root }) => root));
          return { kind, group: original, landmarks,
            createPopulation: (isVisible, revealAt) => createSanDiegoPopulation(original, isVisible, revealAt) };
        } catch (error) { disposeGroup(original); throw error; }
      },
    });
    return {
      group, lod,
      overview: region.overview,
      bounds: region.bounds,
      coverageBounds: region.coverageBounds ?? region.bounds,
      transitionCoverageBounds: region.peripheralGeometryBounds ?? region.coverageBounds ?? region.bounds,
      districts: region.districts.map((district) => district.id === "torrey-highlands"
        ? { ...district, camera: manifest.overview } : district),
      annotations: region.annotations ?? [],
      attribution: region.attribution,
    };
  } catch (error) { disposeGroup(group); throw error; }
}
