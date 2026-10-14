import * as THREE from "three";
import { AMBIENT_LAYOUT } from "../../../../generated/ambient-layout";
import {
  HUDSON_MIN_CITY_TILE_X,
  MANHATTAN_CENTER,
  MANHATTAN_TILE_RADIUS,
  SHARED_DATA_VERSION,
  isAbortError,
  type AmbientAnimation,
  type CityGmlSurface,
  type MapView,
  type Point3,
  type SkyTraveler,
  type WashingtonCityManifest,
  type WashingtonCityRuntimeData,
  type WashingtonParkData,
} from "../../shared/core";
import { disposeSceneObjects } from "../../runtime/dispose-runtime";
import type { SpringArrival } from "../../animation/arrivals";
import { createSkyTravelers } from "../ambient/sky";
import { createPedestrians, createTraffic } from "../ambient/street-life";
import {
  bakeLandmarkAsSingleMesh,
  createCourantGarden,
  createGouldPlaza,
  createInteractiveBuildingGroup,
  createLandmarkDetails,
  createSternRotundaDetails,
} from "../neighborhoods/landmarks";
import {
  createCrosswalks,
  createParkPaths,
  createParkTrees,
  createSimpleArch,
  createSimpleFountain,
  loadBlenderArch,
  loadBobstLibrary,
  loadGlb,
  makeSurfaceGeometry,
} from "../neighborhoods/park";
import type { ClickableLandmark } from "../navigation";

export interface ManhattanLoaderOptions {
  abortController: AbortController;
  isDisposed: () => boolean;
  getActiveStudy: () => MapView;
  scene: THREE.Scene;
  skyOverlayScene: THREE.Scene;
  renderer: THREE.WebGLRenderer;
  ground: THREE.Object3D;
  arrivingTiles: SpringArrival[];
  ambientAnimations: AmbientAnimation[];
  waterArrivalCompleteAt: number;
  waitForVisible: () => Promise<void>;
  yieldToMainThread: () => Promise<void>;
  logLoad: ReturnType<typeof import("../../shared/core").createLoadLogger>;
  loadLogPrefix: string;
  setStatus: (status: string) => void;
  queueSpringArrival: (root: THREE.Object3D, delay?: number, rise?: number, fade?: boolean, durationMs?: number) => void;
  registerClickableLandmark: (root: THREE.Object3D) => ClickableLandmark;
  addNeighborhoodBuildingMarker: (view: "washington" | "union", landmark: ClickableLandmark) => void;
  setRequestNeighborhood: (request: (center: THREE.Vector3, radius: number) => void) => void;
  setSkyTravelers: (travelers: SkyTraveler[]) => void;
  setNavigationArrowSpringStartedAt: (startedAt: number) => void;
}

export function startManhattanLoading(options: ManhattanLoaderOptions): Promise<boolean> {
  const {
    abortController,
    isDisposed,
    getActiveStudy,
    scene,
    skyOverlayScene,
    renderer,
    ground,
    arrivingTiles,
    ambientAnimations,
    waterArrivalCompleteAt,
    waitForVisible,
    yieldToMainThread,
    logLoad,
    loadLogPrefix,
    setStatus,
    queueSpringArrival,
    registerClickableLandmark,
    addNeighborhoodBuildingMarker,
    setRequestNeighborhood,
    setSkyTravelers,
    setNavigationArrowSpringStartedAt,
  } = options;
      const roadVisualReady = loadGlb(`/models/manhattan-roads.glb?v=${SHARED_DATA_VERSION}`, abortController.signal)
        .then((gltf) => {
          if (isDisposed()) { disposeSceneObjects([gltf.scene]); return performance.now(); }
          const roadMaterial = new THREE.MeshStandardMaterial({
            color: 0x6f6a61,
            roughness: 1,
            side: THREE.DoubleSide,
            stencilWrite: true,
            stencilRef: 1,
            stencilFunc: THREE.AlwaysStencilFunc,
            stencilZPass: THREE.ReplaceStencilOp,
          });
          const replacedMaterials = new Set<THREE.Material>();
          gltf.scene.traverse((object) => {
            if (!(object instanceof THREE.Mesh)) return;
            (Array.isArray(object.material) ? object.material : [object.material]).forEach((material) => replacedMaterials.add(material));
            object.material = roadMaterial;
            object.receiveShadow = true;
            object.renderOrder = -1;
          });
          replacedMaterials.forEach((material) => material.dispose());
          gltf.scene.position.y = -34;
          gltf.scene.visible = false;
          gltf.scene.name = "Precompiled NYC 2022 planimetric roadbeds";
          scene.add(gltf.scene);
          const surfaceRevealAt = Math.max(performance.now() + 420, waterArrivalCompleteAt + 80);
          arrivingTiles.push({ root: gltf.scene, materials: [roadMaterial], startedAt: surfaceRevealAt + 100, distance: 0, rise: 34, fade: false });
          return surfaceRevealAt + 100;
        })
        .catch((error) => {
          if (isAbortError(error)) return performance.now();
          throw error;
        });

      // Observe road failures immediately while other assets are being prepared.
      let roadError: unknown;
      const roadSettled = roadVisualReady.catch((error) => { roadError = error; });
      let cityTilesReady: Promise<void> = Promise.resolve();
      logLoad("Data requests started");
      return (async () => {
        try {
          const manifestRequest = fetch("/models/washington-city/manifest.json", { signal: abortController.signal });
          const requests = [
            manifestRequest,
            fetch("/models/washington-city/runtime.json", { signal: abortController.signal }),
            fetch(`/data/washington-square-park.json?v=${SHARED_DATA_VERSION}`, { signal: abortController.signal }),
            fetch(`/data/union-square-park.json?v=${SHARED_DATA_VERSION}`, { signal: abortController.signal }),
          ];
          const [manifestResponse, runtimeResponse, washingtonParkResponse, unionParkResponse] = await Promise.all(requests);
          for (const response of [manifestResponse, runtimeResponse, washingtonParkResponse, unionParkResponse]) {
            if (!response.ok) throw new Error(`${response.url} failed (${response.status})`);
          }
          const [manifest, runtime, washingtonPark, unionPark] = await Promise.all([
            manifestResponse.json() as Promise<WashingtonCityManifest>,
            runtimeResponse.json() as Promise<WashingtonCityRuntimeData>,
            washingtonParkResponse.json() as Promise<WashingtonParkData>,
            unionParkResponse.json() as Promise<WashingtonParkData>,
          ]);
          if (isDisposed()) return false;
          logLoad("Runtime data parsed", {
            buildings: manifest.buildingCount,
            footprints: runtime.footprints.length,
            tiles: manifest.tiles.length,
          });
          // Begin the nearest city-tile downloads before the synchronous route and
          // landmark construction below. Network/decode work can overlap that CPU
          // phase instead of sitting behind it in the startup waterfall.
          const loadedCityTiles = new Map<string, THREE.Group>();
          const loadingCityTiles = new Set<string>();
          const eligibleCityTiles = manifest.tiles.filter((tile) => tile.x >= HUDSON_MIN_CITY_TILE_X);
          const cityTileByFile = new Map(eligibleCityTiles.map((tile) => [tile.file, tile]));
          let neighborhoodRequest = 0;
          let loadedTiles = 0;
          let ambientRevealAt = Number.POSITIVE_INFINITY;
          const loadTile = async (tile: WashingtonCityManifest["tiles"][number], destination: THREE.Vector3) => {
            if (loadedCityTiles.has(tile.file) || loadingCityTiles.has(tile.file)) return;
            await waitForVisible();
            if (isDisposed()) return;
            loadingCityTiles.add(tile.file);
            let gltf: Awaited<ReturnType<typeof loadGlb>>;
            try {
              gltf = await loadGlb(`/models/washington-city/${tile.file}?v=${manifest.version}`, abortController.signal);
            } catch (error) {
              if (isAbortError(error)) return;
              throw error;
            } finally {
              loadingCityTiles.delete(tile.file);
            }
            if (isDisposed()) { disposeSceneObjects([gltf.scene]); return; }
            let roadRevealAt: number;
            try { roadRevealAt = await roadVisualReady; } catch (error) { disposeSceneObjects([gltf.scene]); throw error; }
            if (isDisposed()) { disposeSceneObjects([gltf.scene]); return; }
            gltf.scene.traverse((object) => {
              if (!(object instanceof THREE.Mesh)) return;
              object.receiveShadow = true;
              object.castShadow = object.name === "wall";
              object.frustumCulled = true;
              object.updateMatrix();
              object.matrixAutoUpdate = false;
            });
            const distance = Math.hypot(tile.x - destination.x, tile.z - destination.z);
            gltf.scene.position.y = -34;
            gltf.scene.visible = false;
            scene.add(gltf.scene);
            loadedCityTiles.set(tile.file, gltf.scene);
            arrivingTiles.push({
              root: gltf.scene,
              materials: [],
              startedAt: Math.max(performance.now(), roadRevealAt + 1170) + Math.min(260, distance * 0.34),
              distance,
              rise: 34,
              fade: false,
              freezeRoot: true,
            });
            renderer.shadowMap.needsUpdate = true;
            loadedTiles += 1;
          };
          const loadNeighborhood = async (center: THREE.Vector3, radius: number, initial = false) => {
            const requestId = ++neighborhoodRequest;
            const orderedTiles = eligibleCityTiles
              .filter((tile) => Math.hypot(tile.x - center.x, tile.z - center.z) < radius)
              .sort((a, b) => Math.hypot(a.x - center.x, a.z - center.z) - Math.hypot(b.x - center.x, b.z - center.z));
            const firstBatchSize = Math.min(4, orderedTiles.length);
            const loadedTilesBeforeFirstBatch = loadedTiles;
            let endFirstCityTiles: ((details?: Record<string, unknown>) => void) | null = null;
            if (!initial) {
              for (const tile of orderedTiles) {
                const root = loadedCityTiles.get(tile.file);
                if (!root || arrivingTiles.some((arrival) => arrival.root === root)) continue;
                const distance = Math.hypot(tile.x - center.x, tile.z - center.z);
                root.matrixAutoUpdate = true;
                root.position.y = -24;
                root.visible = false;
                arrivingTiles.push({
                  root,
                  materials: [],
                  startedAt: performance.now() + Math.min(320, distance * 0.4),
                  distance,
                  rise: 24,
                  fade: false,
                  freezeRoot: true,
                });
              }
            }
            for (let index = 0; index < orderedTiles.length; index += 4) {
              await waitForVisible();
              if (isDisposed() || requestId !== neighborhoodRequest) return;
              if (initial && index === 0) {
                endFirstCityTiles = logLoad.start("First city tiles", { requestedTiles: firstBatchSize });
              }
              const batch = await Promise.allSettled(orderedTiles.slice(index, index + 4).map((tile) => loadTile(tile, center)));
              const failed = batch.find((result) => result.status === "rejected");
              if (failed?.status === "rejected") throw failed.reason;
              if (isDisposed() || requestId !== neighborhoodRequest) return;
              if (initial && index === 0) {
                endFirstCityTiles?.({
                  loadedTiles: loadedTiles - loadedTilesBeforeFirstBatch,
                  totalLoadedTiles: loadedTiles,
                });
              }
              await yieldToMainThread();
            }
            window.setTimeout(() => {
              if (isDisposed() || requestId !== neighborhoodRequest) return;
              for (const [file, root] of loadedCityTiles) {
                const tile = cityTileByFile.get(file);
                if (!tile || Math.hypot(tile.x - center.x, tile.z - center.z) <= radius) continue;
                scene.remove(root);
                for (let index = arrivingTiles.length - 1; index >= 0; index -= 1) {
                  if (arrivingTiles[index].root === root) arrivingTiles.splice(index, 1);
                }
                root.traverse((object) => {
                  if (!(object instanceof THREE.Mesh)) return;
                  object.geometry.dispose();
                  (Array.isArray(object.material) ? object.material : [object.material]).forEach((material) => material.dispose());
                });
                loadedCityTiles.delete(file);
              }
            }, 1800);
          };
          setRequestNeighborhood((center, radius) => {
            void loadNeighborhood(center, radius).catch((error) => {
              if (!isAbortError(error)) console.warn(loadLogPrefix, "Neighborhood load failed", error);
            });
          });
          let cityTilesError: unknown;
          const washingtonTrees = createParkTrees(AMBIENT_LAYOUT.washingtonTrees, "Washington Square");
          const unionAndGramercyTrees = createParkTrees(AMBIENT_LAYOUT.unionTrees, "Union Square and Gramercy Park");
          const contextParkTrees = createParkTrees(AMBIENT_LAYOUT.contextTrees, "Manhattan context park");
          // Mount prepared trees immediately so failed/aborted preparation can dispose them.
          scene.add(washingtonTrees, unionAndGramercyTrees, contextParkTrees);
          washingtonTrees.visible = unionAndGramercyTrees.visible = contextParkTrees.visible = false;
          const addCustomLandmarks = async () => {
            const landmarkDetails = createLandmarkDetails(runtime.details);
            const liptonSource = createInteractiveBuildingGroup(runtime.details, ["1008875"], "Lipton Hall source geometry");
            const courantSource = createInteractiveBuildingGroup(runtime.details, ["1008627"], "Courant source geometry");
            const sternSource = createInteractiveBuildingGroup(runtime.details, ["1078952", "1077346"], "Stern source geometry");
            const goldbellySource = createInteractiveBuildingGroup(runtime.details, ["1087304"], "25 Union Square West source geometry");
            const unionSquareCafeSource = createInteractiveBuildingGroup(runtime.details, ["1017906"], "235 Park Avenue South source geometry");
            const liptonDetails = landmarkDetails.get("1008875");
            if (liptonDetails) liptonSource.add(liptonDetails);
            const courantDetails = landmarkDetails.get("1008627");
            if (courantDetails) courantSource.add(courantDetails);
            for (const id of ["1078952", "1077346"]) {
              const details = landmarkDetails.get(id);
              if (details) sternSource.add(details);
            }
            sternSource.add(createSternRotundaDetails());
            const goldbellyDetails = landmarkDetails.get("1087304");
            if (goldbellyDetails) goldbellySource.add(goldbellyDetails);
            const unionSquareCafeDetails = landmarkDetails.get("1017906");
            if (unionSquareCafeDetails) unionSquareCafeSource.add(unionSquareCafeDetails);
            const lipton = bakeLandmarkAsSingleMesh(liptonSource, "Clickable merged Lipton Hall");
            const courant = bakeLandmarkAsSingleMesh(courantSource, "Clickable merged Courant Institute");
            const stern = bakeLandmarkAsSingleMesh(sternSource, "Clickable merged Stern building pair");
            const goldbelly = bakeLandmarkAsSingleMesh(goldbellySource, "Clickable merged 25 Union Square West");
            const unionSquareCafe = bakeLandmarkAsSingleMesh(unionSquareCafeSource, "Clickable merged 235 Park Avenue South");
            const liptonLandmark = registerClickableLandmark(lipton);
            addNeighborhoodBuildingMarker("washington", liptonLandmark);
            queueSpringArrival(lipton, 0);
            const courantLandmark = registerClickableLandmark(courant);
            addNeighborhoodBuildingMarker("washington", courantLandmark);
            queueSpringArrival(courant, 120);
            const sternLandmark = registerClickableLandmark(stern);
            addNeighborhoodBuildingMarker("washington", sternLandmark);
            queueSpringArrival(stern, 240);
            const goldbellyLandmark = registerClickableLandmark(goldbelly);
            addNeighborhoodBuildingMarker("union", goldbellyLandmark);
            queueSpringArrival(goldbelly, 280);
            const unionSquareCafeLandmark = registerClickableLandmark(unionSquareCafe);
            addNeighborhoodBuildingMarker("union", unionSquareCafeLandmark);
            queueSpringArrival(unionSquareCafe, 300);
            createGouldPlaza(scene);
            createCourantGarden(scene);
            for (const [id, details] of landmarkDetails) {
              if (!["1008875", "1008627", "1077346", "1078952", "1087304", "1017906"].includes(id)) {
                scene.add(details);
                queueSpringArrival(details, 320);
              }
            }
            const customLoads: Promise<void>[] = [];
            if (washingtonPark.arch) customLoads.push(loadBlenderArch(washingtonPark.arch, abortController.signal)
              .then((arch) => {
                if (isDisposed()) { disposeSceneObjects([arch]); return; }
                scene.add(arch);
                queueSpringArrival(arch, 360);
              })
              .catch((error) => {
                if (isDisposed() || isAbortError(error)) return;
                const arch = createSimpleArch(washingtonPark.arch!, new THREE.MeshStandardMaterial({ color: 0xf1ede4, roughness: 0.86 }));
                scene.add(arch);
                queueSpringArrival(arch, 360);
              }));
            customLoads.push(loadBobstLibrary(abortController.signal)
              .then((bobst) => {
                if (isDisposed()) { disposeSceneObjects([bobst]); return; }
                const bobstLandmark = registerClickableLandmark(bobst);
                addNeighborhoodBuildingMarker("washington", bobstLandmark);
                queueSpringArrival(bobst, 480);
              })
              .catch((error) => { if (!isAbortError(error)) throw error; }));
            const results = await Promise.allSettled(customLoads);
            const failed = results.find((result) => result.status === "rejected");
            if (failed?.status === "rejected") throw failed.reason;
          };
          logLoad("Ambient geometry ready");
          ground.renderOrder = 0;
          const allParkRings = [
            ...(washingtonPark.parkRings ?? []),
            ...(unionPark.parkRings ?? []),
            ...AMBIENT_LAYOUT.contextParkRings,
          ];
          let parkGround: THREE.Mesh | null = null;
          if (allParkRings.length) {
            const parkSurfaces: CityGmlSurface[] = allParkRings.map((ring) => ({
              kind: "ground",
              ring: ring.map(([x, z]) => [x, 0.74, z] as Point3),
              holes: [],
            }));
            parkGround = new THREE.Mesh(
              makeSurfaceGeometry(parkSurfaces),
              new THREE.MeshStandardMaterial({
                color: 0x9dbd7c,
                roughness: 1,
                side: THREE.DoubleSide,
                stencilWrite: true,
                stencilRef: 1,
                stencilFunc: THREE.NotEqualStencilFunc,
              }),
            );
            parkGround.receiveShadow = true;
            parkGround.name = "OpenStreetMap Manhattan park grass";
            scene.add(parkGround);
            parkGround.visible = false;
          }
          scene.add(createCrosswalks(washingtonPark.crossings, new THREE.MeshBasicMaterial({
            color: 0xfffdf5,
            depthTest: true,
            depthWrite: true,
          })));
          logLoad("Critical park geometry ready");
          // Attach abort handling immediately. This promise is awaited only after
          // deferred scene construction, so React teardown can otherwise reject
          // it before an await has installed a handler and trigger an unhandled
          // rejection in the browser.
          cityTilesReady = loadNeighborhood(MANHATTAN_CENTER, MANHATTAN_TILE_RADIUS, true).catch((error) => {
            if (isAbortError(error)) return;
            cityTilesError = error;
          });
          await waitForVisible();
          if (isDisposed()) return false;
          const endDeferredRoutes = logLoad.start("Deferred routes", {
            pedestrians: AMBIENT_LAYOUT.pedestrians.length,
            traffic: AMBIENT_LAYOUT.traffic.length,
            paths: AMBIENT_LAYOUT.parkPaths.length,
          });
          ambientAnimations.push(createPedestrians(scene, () => getActiveStudy() === "washington" || getActiveStudy() === "union", () => ambientRevealAt + 500));
          await yieldToMainThread();
          await waitForVisible();
          if (isDisposed()) return false;
          ambientAnimations.push(createTraffic(scene, () => ambientRevealAt + 250, () => ["manhattan", "washington", "union"].includes(getActiveStudy())));
          const parkPaths = createParkPaths(
            new THREE.MeshStandardMaterial({ color: 0xc6baa6, roughness: 1 }),
          );
          scene.add(parkPaths);
          parkPaths.visible = false;
          endDeferredRoutes();
          const fountain = washingtonPark.fountain ? createSimpleFountain(washingtonPark.fountain) : null;
          if (fountain) { scene.add(fountain.group); fountain.group.visible = false; }
          await cityTilesReady;
          if (cityTilesError) throw cityTilesError;
          await roadSettled;
          if (roadError) throw roadError;
          await waitForVisible();
          if (isDisposed()) return false;
          await addCustomLandmarks();
          ambientRevealAt = performance.now() + 180;
          if (parkGround) queueSpringArrival(parkGround, 0, 18);
          queueSpringArrival(parkPaths, 0);
          scene.add(washingtonTrees, unionAndGramercyTrees, contextParkTrees);
          queueSpringArrival(washingtonTrees, 120);
          queueSpringArrival(unionAndGramercyTrees, 180);
          queueSpringArrival(contextParkTrees, 240);
          if (fountain) {
            scene.add(fountain.group);
            queueSpringArrival(fountain.group, 300);
            ambientAnimations.push(fountain.animation);
          }
          if (!isDisposed()) {
            const skyTravelers = createSkyTravelers(scene, skyOverlayScene);
            setSkyTravelers(skyTravelers);
            for (const traveler of skyTravelers) {
              traveler.group.visible = false;
              queueSpringArrival(traveler.group, 1650);
            }
            setNavigationArrowSpringStartedAt(performance.now() + 1900);
          }
          return !isDisposed();
        } catch (error) {
          abortController.abort();
          await Promise.allSettled([roadSettled, cityTilesReady]);
          if (isAbortError(error) || isDisposed()) return false;
          console.error(loadLogPrefix, "Scene load failed", error);
          setStatus(error instanceof Error ? error.message : "Scene load failed");
          return false;
        }
      })();

}
