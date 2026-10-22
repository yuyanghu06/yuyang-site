import * as THREE from "three";
import {
  HUDSON_MIN_CITY_TILE_X,
  NEIGHBORHOOD_TILE_RADIUS,
  SHARED_DATA_VERSION,
  WASHINGTON_CENTER,
  UNION_CENTER,
  type AmbientAnimation,
  type CityGmlSurface,
  type MapView,
  type Point3,
  type SkyTraveler,
  type WashingtonCityManifest,
  type WashingtonCityRuntimeData,
  type WashingtonParkData,
} from "../../shared/core";
import { loadGlb, replaceMeshMaterials } from "../../shared/gltf-loader";
import { disposeSceneObjects } from "../../runtime/dispose-runtime";
import { createSkyTravelers } from "../ambient/sky";
import type { ClickableLandmark } from "../navigation";

type Neighborhood = "washington" | "union";
interface OverviewManifest {
  modelUrl: string;
  contentHash: string;
  details: { url: string; contentHash: string };
}

export interface ManhattanLoaderOptions {
  isDisposed: () => boolean;
  getActiveStudy: () => MapView;
  scene: THREE.Scene;
  skyOverlayScene: THREE.Scene;
  renderer: THREE.WebGLRenderer;
  ambientAnimations: AmbientAnimation[];
  waitForVisible: () => Promise<void>;
  yieldToMainThread: () => Promise<void>;
  registerClickableLandmark: (root: THREE.Object3D) => ClickableLandmark;
  addNeighborhoodBuildingMarker: (view: Neighborhood, landmark: ClickableLandmark) => void;
  rollbackLandmarkRegistration: () => void;
  setSkyTravelers: (travelers: SkyTraveler[]) => void;
  setNavigationArrowSpringStartedAt: (startedAt: number) => void;
}

/** Prepared layers mount atomically; creating this controller starts no requests. */
export function startManhattanLoading(options: ManhattanLoaderOptions) {
  const { scene, skyOverlayScene, renderer, getActiveStudy, waitForVisible, yieldToMainThread,
    registerClickableLandmark, addNeighborhoodBuildingMarker, ambientAnimations } = options;
  const lifecycle = new AbortController();
  let disposed = false;
  const isDisposed = () => disposed || options.isDisposed();
  const checkCurrent = (signal = lifecycle.signal) => {
    if (isDisposed() || signal.aborted) throw new DOMException("City preparation cancelled", "AbortError");
  };
  const fetchJson = async <T,>(url: string): Promise<T> => {
    const response = await fetch(url, { signal: lifecycle.signal, cache: "no-cache" });
    if (!response.ok) throw new Error(`${url} failed (${response.status})`);
    const data = await response.json() as T;
    checkCurrent();
    return data;
  };
  const overview = new THREE.Group();
  overview.name = "Prepared compact Manhattan overview";
  const detailLayer = new THREE.Group();
  detailLayer.name = "Prepared exact NYC neighborhood geometry";
  detailLayer.visible = false;
  const tiles = new Map<string, THREE.Group>();
  const readyNeighborhoods = new Map<Neighborhood, Set<string>>();
  let overviewReady = false;
  let overviewPromise: Promise<void> | null = null;
  let sharedParks: THREE.Scene | null = null;
  let manifestPromise: Promise<OverviewManifest> | null = null;
  let tileManifestPromise: Promise<WashingtonCityManifest> | null = null;
  let detailsPromise: Promise<PreparedDetails> | null = null;
  let preparedDetails: PreparedDetails | null = null;
  let detailsInstalled = false;
  let generation = 0;
  let pending: { view: Neighborhood; controller: AbortController; promise: Promise<void> } | null = null;
  type PreparedDetails = {
    group: THREE.Scene;
    landmarks: Array<{ root: THREE.Object3D; view: Neighborhood }>;
    animations: AmbientAnimation[];
  };
  const getManifest = () => manifestPromise ??= fetchJson<OverviewManifest>("/models/washington-city/overview-manifest.json")
    .catch((error) => { manifestPromise = null; throw error; });
  const getTileManifest = () => tileManifestPromise ??= fetchJson<WashingtonCityManifest>("/models/washington-city/manifest.json")
    .catch((error) => { tileManifestPromise = null; throw error; });

  const loadParkData = async () => {
    const [washingtonPark, unionPark, { AMBIENT_LAYOUT }, park, landmarkHelpers] = await Promise.all([
      fetchJson<WashingtonParkData>(`/data/washington-square-park.json?v=${SHARED_DATA_VERSION}`),
      fetchJson<WashingtonParkData>(`/data/union-square-park.json?v=${SHARED_DATA_VERSION}`),
      import("../../../../generated/ambient-layout"),
      import("../neighborhoods/park"),
      import("../neighborhoods/landmarks"),
    ]);
    return { washingtonPark, unionPark, AMBIENT_LAYOUT, park, landmarkHelpers };
  };
  let parkDataPromise: ReturnType<typeof loadParkData> | null = null;
  const getParkData = () => parkDataPromise ??= loadParkData()
    .catch((error) => { parkDataPromise = null; throw error; });

  const prepareSharedParks = async () => {
    const group = new THREE.Scene();
    group.name = "Prepared shared NYC park scenery";
    const animations: AmbientAnimation[] = [];
    try {
      const { washingtonPark, AMBIENT_LAYOUT, park, landmarkHelpers } = await getParkData();
      checkCurrent();
      group.add(park.createCrosswalks(washingtonPark.crossings,
        new THREE.MeshBasicMaterial({ color: 0xfffdf5, depthTest: true, depthWrite: true })));
      group.add(park.createParkPaths(new THREE.MeshStandardMaterial({ color: 0xc6baa6, roughness: 1 })));
      // Attach each factory result immediately so later preparation failures own
      // every previously constructed mesh and its instancing buffers.
      group.add(park.createParkTrees(AMBIENT_LAYOUT.washingtonTrees, "Washington Square"));
      group.add(park.createParkTrees(AMBIENT_LAYOUT.unionTrees, "Union Square and Gramercy Park"));
      group.add(park.createParkTrees(AMBIENT_LAYOUT.contextTrees, "Manhattan context park"));
      landmarkHelpers.createGouldPlaza(group);
      landmarkHelpers.createCourantGarden(group);
      if (washingtonPark.fountain) {
        const fountain = park.createSimpleFountain(washingtonPark.fountain);
        group.add(fountain.group);
        fountain.animation.update(0);
        animations.push({ update: (elapsed) => {
          const view = getActiveStudy();
          if (view === "manhattan" || view === "washington" || view === "union") fountain.animation.update(elapsed);
        } });
      }
      return { group, animations };
    } catch (error) {
      disposeSceneObjects([group]);
      throw error;
    }
  };

  const ensureOverview = () => {
    if (overviewReady) return Promise.resolve();
    if (overviewPromise) return overviewPromise;
    overviewPromise = (async () => {
      const roots: THREE.Object3D[] = [];
      const stagedSky = new THREE.Scene();
      const stagedSkyOverlay = new THREE.Scene();
      let installed = false;
      try {
        // Observe every sibling even after failure: completed park geometry
        // and late decoded GLBs remain owned until mounted or disposed together.
        const [buildingResult, roadResult, parkResult] = await Promise.allSettled([
          getManifest().then((manifest) => loadGlb(`${manifest.modelUrl}?v=${manifest.contentHash}`, lifecycle.signal)),
          loadGlb(`/models/manhattan-roads.glb?v=${SHARED_DATA_VERSION}`, lifecycle.signal),
          prepareSharedParks(),
        ]);
        if (buildingResult.status === "fulfilled") roots.push(buildingResult.value.scene);
        if (roadResult.status === "fulfilled") roots.push(roadResult.value.scene);
        if (parkResult.status === "fulfilled") roots.push(parkResult.value.group);
        if (buildingResult.status === "rejected") throw buildingResult.reason;
        if (roadResult.status === "rejected") throw roadResult.reason;
        if (parkResult.status === "rejected") throw parkResult.reason;
        checkCurrent();
        const buildings = buildingResult.value.scene;
        const roads = roadResult.value.scene;
        buildings.traverse((object) => {
          if (!(object instanceof THREE.Mesh)) return;
          object.raycast = () => undefined;
          for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
            if (material instanceof THREE.MeshStandardMaterial) {
              material.flatShading = true;
              if (object.name === "overview-park-grass") {
                material.stencilWrite = true;
                material.stencilRef = 1;
                material.stencilFunc = THREE.NotEqualStencilFunc;
                object.receiveShadow = true;
              }
            }
          }
        });
        replaceMeshMaterials(roads, new THREE.MeshStandardMaterial({
          color: 0x6f6a61, roughness: 1, side: THREE.DoubleSide,
          stencilWrite: true, stencilRef: 1, stencilFunc: THREE.AlwaysStencilFunc, stencilZPass: THREE.ReplaceStencilOp,
        }));
        roads.traverse((object) => {
          if (!(object instanceof THREE.Mesh)) return;
          object.receiveShadow = true;
          object.renderOrder = -1;
        });
        const travelers = createSkyTravelers(stagedSky, stagedSkyOverlay);
        overview.add(buildings);
        // Roads and shared park scenery remain visible in every NYC view.
        scene.add(overview, roads, detailLayer, parkResult.value.group, ...stagedSky.children);
        skyOverlayScene.add(...stagedSkyOverlay.children);
        options.setSkyTravelers(travelers);
        sharedParks = parkResult.value.group;
        ambientAnimations.push(...parkResult.value.animations);
        installed = true;
        overviewReady = true;
      } finally {
        if (!installed) {
          overview.clear();
          disposeSceneObjects([...roots, stagedSky, stagedSkyOverlay]);
        }
      }
    })().finally(() => { overviewPromise = null; });
    return overviewPromise;
  };

  const ensureDetails = () => {
    if (preparedDetails) return Promise.resolve(preparedDetails);
    if (detailsPromise) return detailsPromise;
    detailsPromise = (async () => {
      const staging = new THREE.Scene();
      const landmarks: PreparedDetails["landmarks"] = [];
      const animations: AmbientAnimation[] = [];
      let retained = false;
      try {
        const [runtime, { washingtonPark, unionPark, AMBIENT_LAYOUT, park, landmarkHelpers }, streetLife] = await Promise.all([
          getManifest().then((manifest) => fetchJson<Pick<WashingtonCityRuntimeData, "details">>(`${manifest.details.url}?v=${manifest.details.contentHash}`)),
          getParkData(),
          import("../ambient/street-life"),
        ]);
        checkCurrent();
        const { createSimpleArch, loadBlenderArch, loadBobstLibrary, makeSurfaceGeometry } = park;
        const { bakeLandmarkAsSingleMesh, createInteractiveBuildingGroup,
          createLandmarkDetails, createSternRotundaDetails } = landmarkHelpers;
        // GLB downloads finish before any registration. Failed preparation leaves
        // the current view intact, and all fulfilled/late siblings are owned here.
        const modelResults = await Promise.allSettled([
          washingtonPark.arch ? loadBlenderArch(washingtonPark.arch, lifecycle.signal).catch((error) => {
            checkCurrent();
            console.warn("[New York] Using the authored fallback arch", error);
            return createSimpleArch(washingtonPark.arch!, new THREE.MeshStandardMaterial({ color: 0xf1ede4, roughness: 0.86 }));
          }) : Promise.resolve(null),
          loadBobstLibrary(lifecycle.signal),
        ]);
        for (const result of modelResults) if (result.status === "fulfilled" && result.value) staging.add(result.value);
        const failed = modelResults.find((result) => result.status === "rejected");
        if (failed?.status === "rejected") throw failed.reason;
        checkCurrent();
        const bobst = modelResults[1].status === "fulfilled" ? modelResults[1].value : null;
        if (bobst) landmarks.push({ root: bobst, view: "washington" });
        const stageLandmark = (root: THREE.Object3D) => { staging.add(root); return root; };
        const stageMarker = (view: Neighborhood, root: THREE.Object3D) => landmarks.push({ root, view });
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
        // The baked meshes own independent geometry/materials. Their source
        // groups (including facade instance buffers) never enter the scene.
        disposeSceneObjects([liptonSource, courantSource, sternSource, goldbellySource, unionSquareCafeSource]);
        const liptonLandmark = stageLandmark(lipton);
        stageMarker("washington", liptonLandmark);
        const courantLandmark = stageLandmark(courant);
        stageMarker("washington", courantLandmark);
        const sternLandmark = stageLandmark(stern);
        stageMarker("washington", sternLandmark);
        const goldbellyLandmark = stageLandmark(goldbelly);
        stageMarker("union", goldbellyLandmark);
        const unionSquareCafeLandmark = stageLandmark(unionSquareCafe);
        stageMarker("union", unionSquareCafeLandmark);
        for (const [id, details] of landmarkDetails) {
          if (!["1008875", "1008627", "1077346", "1078952", "1087304", "1017906"].includes(id)) {
            staging.add(details);
          }
        }
        const allParkRings = [...(washingtonPark.parkRings ?? []), ...(unionPark.parkRings ?? []), ...AMBIENT_LAYOUT.contextParkRings];
        if (allParkRings.length) {
          const surfaces: CityGmlSurface[] = allParkRings.map((ring) => ({
            kind: "ground", ring: ring.map(([x, z]) => [x, 0.74, z] as Point3), holes: [],
          }));
          const grass = new THREE.Mesh(makeSurfaceGeometry(surfaces), new THREE.MeshStandardMaterial({
            color: 0x9dbd7c, roughness: 1, side: THREE.DoubleSide, stencilWrite: true,
            stencilRef: 1, stencilFunc: THREE.NotEqualStencilFunc,
          }));
          grass.receiveShadow = true;
          grass.name = "OpenStreetMap Manhattan park grass";
          staging.add(grass);
        }
        const isNeighborhood = () => getActiveStudy() === "washington" || getActiveStudy() === "union";
        animations.push(streetLife.createPedestrians(staging, isNeighborhood, () => 0),
          streetLife.createTraffic(staging, () => 0, isNeighborhood));
        checkCurrent();
        preparedDetails = { group: staging, landmarks, animations };
        retained = true;
        return preparedDetails;
      } finally {
        if (!retained) disposeSceneObjects([staging]);
      }
    })().finally(() => { detailsPromise = null; });
    return detailsPromise;
  };

  const ensureNeighborhood = (view: Neighborhood) => {
    if (readyNeighborhoods.has(view)) return Promise.resolve();
    if (pending?.view === view) return pending.promise;
    pending?.controller.abort();
    const requestGeneration = ++generation;
    const controller = new AbortController();
    const signal = AbortSignal.any([controller.signal, lifecycle.signal]);
    const request = { view, controller, promise: Promise.resolve() };
    request.promise = (async () => {
      const staged = new Map<string, THREE.Group>();
      let installed = false;
      try {
        const detailsReady = ensureDetails();
        void detailsReady.catch(() => undefined);
        const [manifest] = await Promise.all([getTileManifest(), ensureOverview()]);
        checkCurrent(signal);
        const center = view === "union" ? UNION_CENTER : WASHINGTON_CENTER;
        const ordered = manifest.tiles.filter((tile) => tile.x >= HUDSON_MIN_CITY_TILE_X
          && Math.hypot(tile.x - center.x, tile.z - center.z) < NEIGHBORHOOD_TILE_RADIUS)
          .sort((a, b) => Math.hypot(a.x - center.x, a.z - center.z) - Math.hypot(b.x - center.x, b.z - center.z));
        for (let index = 0; index < ordered.length; index += 4) {
          await waitForVisible();
          checkCurrent(signal);
          const results = await Promise.allSettled(ordered.slice(index, index + 4).map(async (tile) => {
            if (tiles.has(tile.file)) return;
            const { scene: root } = await loadGlb(`/models/washington-city/${tile.file}?v=${manifest.version}`, signal);
            staged.set(tile.file, root);
            checkCurrent(signal);
            root.traverse((object) => {
              if (!(object instanceof THREE.Mesh)) return;
              object.receiveShadow = true;
              object.castShadow = object.name === "wall";
              object.frustumCulled = true;
              object.updateMatrix();
              object.matrixAutoUpdate = false;
            });
          }));
          const failed = results.find((result) => result.status === "rejected");
          if (failed?.status === "rejected") throw failed.reason;
          await yieldToMainThread();
        }
        checkCurrent(signal);
        if (requestGeneration !== generation) throw new DOMException("Navigation superseded", "AbortError");
        const details = await detailsReady;
        checkCurrent(signal);
        // Registration happens only after every required tile/model is decoded.
        if (!detailsInstalled) {
          try {
            for (const { root, view: neighborhood } of details.landmarks) {
              const landmark = registerClickableLandmark(root);
              details.group.add(root);
              addNeighborhoodBuildingMarker(neighborhood, landmark);
            }
          } catch (error) {
            options.rollbackLandmarkRegistration();
            for (const { root } of details.landmarks) details.group.add(root);
            throw error;
          }
          detailLayer.add(details.group);
          ambientAnimations.push(...details.animations);
          options.setNavigationArrowSpringStartedAt(performance.now() - 2000);
          detailsInstalled = true;
        }
        for (const [file, root] of staged) { detailLayer.add(root); tiles.set(file, root); }
        readyNeighborhoods.set(view, new Set(ordered.map((tile) => tile.file)));
        installed = true;
        renderer.shadowMap.needsUpdate = true;
      } finally {
        if (!installed) disposeSceneObjects([...staged.values()]);
      }
    })().finally(() => { if (pending === request) pending = null; });
    pending = request;
    return request.promise;
  };

  return {
    ensureOverview,
    ensureNeighborhood,
    isReady: (view: MapView) => view === "manhattan" ? overviewReady
      : (view === "washington" || view === "union") && readyNeighborhoods.has(view),
    setView(view: MapView) {
      const neighborhood = view === "washington" || view === "union" ? view : null;
      overview.visible = !neighborhood;
      detailLayer.visible = !!neighborhood;
      if (sharedParks) sharedParks.visible = view === "manhattan" || !!neighborhood;
      for (const [file, root] of tiles) root.visible = !!neighborhood && !!readyNeighborhoods.get(neighborhood)?.has(file);
    },
    cancelPendingExcept(view: string) {
      if (pending && pending.view !== view) { generation += 1; pending.controller.abort(); pending = null; }
    },
    dispose() {
      disposed = true;
      generation += 1;
      lifecycle.abort();
      pending?.controller.abort();
      pending = null;
      if (preparedDetails && !detailsInstalled) disposeSceneObjects([preparedDetails.group]);
      preparedDetails = null;
      // Mounted layers belong to the runtime's shared scene disposal traversal.
    },
  };
}
