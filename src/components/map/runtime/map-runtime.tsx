/* eslint-disable max-lines */
"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import * as THREE from "three";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { AMBIENT_LAYOUT } from "../../../generated/ambient-layout";
import AvatarCall from "../../avatar-call";
import { Point3, CityGmlSurface, WashingtonCityRuntimeData, WashingtonCityManifest, WashingtonParkData, SHARED_DATA_VERSION, isAbortError, createLoadLogger, SkyTraveler, AmbientAnimation, BLOCKED_ZOOM_DURATION_MS, BLOCKED_ZOOM_SCALE, BLOCKED_ZOOM_GESTURE_SETTLE_MS, NAVIGATION_ARROW_Y, NAVIGATION_ARROW_SCALE, NAVIGATION_ARROW_SPRING_DURATION_MS, WASHINGTON_ARROW_POSITION, UNION_ARROW_POSITION, MANHATTAN_CENTER, WASHINGTON_CENTER, UNION_CENTER, WASHINGTON_PARK_VISUAL_CENTER, UNION_PARK_VISUAL_CENTER, MANHATTAN_TILE_RADIUS, NEIGHBORHOOD_TILE_RADIUS, PARK_ZOOM_HIT_RADIUS, MANHATTAN_CAMERA_HEIGHT, MANHATTAN_CAMERA_RADIUS, HUDSON_MIN_CITY_TILE_X, WORLD_UP, MapView, type CityOverview } from "../shared/core";
import { GLOBE_RADIUS, GLOBE_START_CAMERA_DISTANCE, GLOBE_MAX_CAMERA_DISTANCE, createWatercolorGlobe, createStarField, northUpGlobeQuaternion, IMPORTED_EARTH_SD_LATITUDE, IMPORTED_EARTH_SD_LONGITUDE } from "../globe/scene";
import { createManhattanDestinationMarker, ClickableLandmark, createBuildingGlow, createWorldNavigationArrow } from "../manhattan/navigation";
import { makeSurfaceGeometry, createParkPaths, createParkTrees, createSimpleFountain, createSimpleArch, loadGlb, loadBlenderArch, loadBobstLibrary, createCrosswalks } from "../manhattan/neighborhoods/park";
import { createNeighborhoodBirdTravelers, createGlobeClouds, createSkyTravelers } from "../manhattan/ambient/sky";
import { createPedestrians, createTraffic } from "../manhattan/ambient/street-life";
import { createInteractiveBuildingGroup, bakeLandmarkAsSingleMesh, createLandmarkDetails, createSternRotundaDetails, createGouldPlaza, createCourantGarden } from "../manhattan/neighborhoods/landmarks";
import { createHudsonWaterAndPier, createEastRiverWaterAndPiers } from "../manhattan/waterfront";
import { createMapRenderer, renderMapFrame } from "../shared/rendering";
import { animateGlobeClouds } from "../animation/globe-clouds";
import { animateGlobeTravelers, createGlobeTravelers } from "../animation/globe-travelers";
import { animateLandmarks } from "../animation/landmarks";
import { animateTravelers } from "../animation/travelers";
import { animateArrivals, type SpringArrival } from "../animation/arrivals";
import {
  animateDestinationMarkers,
  animateNavigationArrow,
  animateNeighborhoodMarkers,
} from "../animation/markers";
import { createAdaptiveResolution } from "../animation/adaptive-resolution";
import { startManhattanLoading } from "../manhattan/loading/manhattan-loader";
import { disposeScenes, disposeSceneObjects } from "./dispose-runtime";
import { createHitTesting } from "../interaction/hit-testing";
import { createInputController } from "../interaction/input-controller";
import { createViewportLifecycle } from "./viewport-lifecycle";
import { getLandmarkFitZoom } from "./landmark-framing";
import { constrainCameraToCoverage, getCoverageDepthRange } from "./coverage-framing";
import { getNextNavigationView } from "./navigation-route";
import { createSanDiegoDistrictMarker, createSanDiegoLabel, constrainSanDiegoLabels } from "../san-diego/district-markers";
import type { SanDiegoCamera, SanDiegoDistrict } from "../san-diego/load-scene";
import { adjustFreeCamera, serializeFreeCamera, SAN_DIEGO_FREE_CAMERA_ENABLED, type FreeCameraGesture } from "./san-diego-free-camera";
import { AGENT_COMMAND_EVENT, createMapViewSettledReporter, type AgentCommand } from "@/agent/contracts/types";
import { getCameraView, getCityOverview, isSanDiegoView, getLandmarkCameraViewForRoot, type CameraViewId, type SanDiegoDistrictView } from "@/agent/context/camera-views";
import { createMapAudioController } from "../../site-audio";

export default function GlobalMap({ experienceStarted }: { experienceStarted: boolean }) {
  const mountRef = useRef<HTMLDivElement>(null);
  const switchStudyRef = useRef<(next: MapView, updateUrl?: boolean) => void>(() => undefined);
  const experienceStartedRef = useRef(experienceStarted);
  const [status, setStatus] = useState("");
  const [currentView, setCurrentView] = useState<CameraViewId>("globe");
  const freeCameraActionsRef = useRef<{ reset: () => void; snapshot: () => string | null } | null>(null);
  const [cameraCopyStatus, setCameraCopyStatus] = useState("");
  const [cameraCopyFallback, setCameraCopyFallback] = useState("");
  const showFreeCamera = SAN_DIEGO_FREE_CAMERA_ENABLED
    && isSanDiegoView(currentView);
  const copyCameraView = async () => {
    const snapshot = freeCameraActionsRef.current?.snapshot();
    if (!snapshot) return;
    try {
      await navigator.clipboard.writeText(snapshot);
      setCameraCopyStatus("View copied.");
      setCameraCopyFallback("");
    } catch {
      setCameraCopyStatus("Clipboard unavailable. Select and copy this view:");
      setCameraCopyFallback(snapshot);
    }
  };

  useEffect(() => {
    experienceStartedRef.current = experienceStarted;
  }, [experienceStarted]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    let activeStudy: MapView = "globe";
    const mapAudio = createMapAudioController();
    const isUnion = false;
    const studyName = isUnion ? "Union Square" : "Washington Square";
    const loadLogPrefix = `[${studyName.replaceAll(" ", "")} load]`;
    const logLoad = createLoadLogger(loadLogPrefix);
    const parkCenter = MANHATTAN_CENTER.clone().setY(0);
    let disposed = false;
    let frame = 0;
    const abortController = new AbortController();
    const visibilityWaiters = new Set<() => void>();
    const waitForVisible = () => {
      if (document.visibilityState === "visible") return Promise.resolve();
      return new Promise<void>((resolve) => visibilityWaiters.add(resolve));
    };
    const yieldToMainThread = () => new Promise<void>((resolve) => window.setTimeout(resolve, 0));

    const scene = new THREE.Scene();
    const sanDiegoScene = new THREE.Scene();
    sanDiegoScene.name = "San Diego — coast and canyon districts";
    sanDiegoScene.background = new THREE.Color(0x9fb77f);
    sanDiegoScene.add(new THREE.HemisphereLight(0xfffcf2, 0x839975, 1.9));
    const sanDiegoSun = new THREE.DirectionalLight(0xfff0d9, 1.4);
    sanDiegoSun.position.set(-900, 1800, 800);
    sanDiegoSun.castShadow = true;
    sanDiegoSun.shadow.mapSize.set(2048, 2048);
    Object.assign(sanDiegoSun.shadow.camera, { left: -1600, right: 1600, top: 1600, bottom: -1600, far: 5000 });
    sanDiegoSun.shadow.camera.updateProjectionMatrix();
    // The map is measured in meters. A six-texel PCF disk spans entire houses
    // and samples their own sloping depth planes, producing receiver stripes.
    sanDiegoSun.shadow.bias = -0.00035;
    sanDiegoSun.shadow.normalBias = 0.8;
    sanDiegoSun.shadow.radius = 0.5;
    sanDiegoScene.add(sanDiegoSun, sanDiegoSun.target);
    let sanDiegoOverview: SanDiegoCamera = { target: [0, 0, 0], height: 12000, radius: 14000, zoom: 0.03 };
    let sanDiegoCoverage: THREE.Box3 | null = null;
    const sanDiegoDistricts = new Map<SanDiegoDistrictView, SanDiegoDistrict>();
    const sanDiegoDistrictMarkers = new Map<THREE.Object3D, SanDiegoDistrictView>();
    const sanDiegoDistrictBounds = new Map<SanDiegoDistrictView, THREE.Box3>();
    const sanDiegoAnnotations: { root: THREE.Sprite; view: SanDiegoDistrictView; anchor: THREE.Vector3 }[] = [];
    let sanDiegoReady = false;
    let sanDiegoLoading: Promise<boolean> | null = null;
    let ensureSanDiego: () => Promise<boolean> = () => Promise.resolve(false);
    const globeScene = new THREE.Scene();
    const skyOverlayScene = new THREE.Scene();
    skyOverlayScene.add(new THREE.HemisphereLight(0xffffff, 0xded8cc, 2.4));
    const skyOverlayKey = new THREE.DirectionalLight(0xffffff, 1.8);
    skyOverlayKey.position.set(-600, 1200, 500);
    skyOverlayScene.add(skyOverlayKey);
    // Water is the persistent frame-zero backdrop. The land datum springs over
    // it, so river areas never change color when the WebGL canvas takes over.
    scene.background = new THREE.Color(0x354345);
    scene.fog = null;

    globeScene.background = new THREE.Color(0x000000);
    globeScene.add(createStarField());
    globeScene.add(new THREE.HemisphereLight(0xfff4dc, 0x71838a, 2.45));
    const globeKey = new THREE.DirectionalLight(0xffd7a3, 2.15);
    globeKey.position.set(-520, 760, 820);
    globeScene.add(globeKey);
    const {
      group: globe,
      marker: manhattanGlobeMarker,
      leader: manhattanGlobeLeader,
      sanDiegoMarker: sanDiegoGlobeMarker,
      sanDiegoLeader: sanDiegoGlobeLeader,
      placeholder: globePlaceholder,
    } = createWatercolorGlobe();
    const globeClouds = createGlobeClouds();
    const globeTravelers = createGlobeTravelers();
    const globeCloudLocalDown = new THREE.Vector3(0, -1, 0);
    const globeCloudInward = new THREE.Vector3();
    globe.add(globeClouds);
    globe.add(globeTravelers);
    globeScene.add(globe);
    void loadGlb("/models/low-poly-planet-earth-e54e8607.glb", abortController.signal)
      .then((gltf) => {
        if (disposed) { disposeSceneObjects([gltf.scene]); return; }
        const bounds = new THREE.Box3().setFromObject(gltf.scene);
        const size = bounds.getSize(new THREE.Vector3());
        const center = bounds.getCenter(new THREE.Vector3());
        const scale = (GLOBE_RADIUS * 2) / Math.max(size.x, size.y, size.z);
        gltf.scene.scale.setScalar(scale);
        gltf.scene.position.copy(center).multiplyScalar(-scale);
        gltf.scene.name = "Lowpoly Earth by morejpeg — recolored ocean and land";
        gltf.scene.traverse((object) => {
          if (!(object instanceof THREE.Mesh)) return;
          object.castShadow = false;
          object.receiveShadow = false;
          if (object.name.toLowerCase().includes("water")) {
            const materials = Array.isArray(object.material) ? object.material : [object.material];
            for (const material of materials) {
              if (!(material instanceof THREE.MeshStandardMaterial)) continue;
              material.color.set(0x7894a0);
              material.roughness = 0.9;
              material.metalness = 0;
            }
          }
        });
        globe.add(gltf.scene);
        globe.remove(globePlaceholder);
        globePlaceholder.geometry.dispose();
        (globePlaceholder.material as THREE.Material).dispose();
      })
      .catch((error) => {
        if (!isAbortError(error)) console.warn("[Globe] Imported Earth failed; using placeholder", error);
      });
    const globeMarkers = new Map<CityOverview, THREE.Object3D>([
      ["manhattan", manhattanGlobeMarker], ["san-diego", sanDiegoGlobeMarker],
    ]);
    const globeMarkerStates = [
      { destination: "manhattan" as const, marker: manhattanGlobeMarker, leader: manhattanGlobeLeader },
      { destination: "san-diego" as const, marker: sanDiegoGlobeMarker, leader: sanDiegoGlobeLeader },
    ].map((entry) => {
      const markerMaterials: Array<THREE.MeshBasicMaterial | THREE.SpriteMaterial> = [];
      const leaderMaterials: THREE.LineBasicMaterial[] = [];
      entry.marker.traverse((object) => {
        if (!(object instanceof THREE.Mesh || object instanceof THREE.Sprite || object instanceof THREE.Line)) return;
        for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
          if (material instanceof THREE.LineBasicMaterial) leaderMaterials.push(material);
          else if (material instanceof THREE.MeshBasicMaterial || material instanceof THREE.SpriteMaterial) markerMaterials.push(material);
        }
      });
      return { ...entry, markerMaterials, leaderMaterials, facing: 0 };
    });
    const markerWorldPosition = new THREE.Vector3();
    const globeCameraDirection = new THREE.Vector3();
    const globeHomeQuaternion = globe.quaternion.clone();
    const globeTransitionStartQuaternion = globe.quaternion.clone();
    const globeTransitionTargetQuaternion = globe.quaternion.clone();
    const cityGlobeQuaternions = {
      manhattan: globeHomeQuaternion.clone(),
      "san-diego": northUpGlobeQuaternion(IMPORTED_EARTH_SD_LATITUDE, IMPORTED_EARTH_SD_LONGITUDE),
    };
    const globeYawQuaternion = new THREE.Quaternion();
    const globePitchQuaternion = new THREE.Quaternion();
    const globeScreenRight = new THREE.Vector3(1, 0, 0);
    let globeOrbitYaw = 0;
    let globeOrbitPitch = 0;
    const updateGlobeOrbit = () => {
      globeYawQuaternion.setFromAxisAngle(WORLD_UP, globeOrbitYaw);
      globePitchQuaternion.setFromAxisAngle(globeScreenRight, globeOrbitPitch);
      globe.quaternion.copy(globePitchQuaternion).multiply(globeYawQuaternion).multiply(globeHomeQuaternion);
    };
    const globeCamera = new THREE.PerspectiveCamera(34, 1, 10, 4000);
    const globeCameraStart = new THREE.Vector3(0, 0, GLOBE_START_CAMERA_DISTANCE);
    const globeCameraEnd = new THREE.Vector3(0, 0, GLOBE_RADIUS + 42);
    globeCamera.position.copy(globeCameraStart);
    globeCamera.lookAt(0, 0, 0);
    let globeCameraDistance = globeCameraStart.length();
    let globeBlockedZoomStartedAt = 0;
    let globeBlockedZoomOriginDistance = globeCameraDistance;
    const setGlobeCameraDistance = (distance: number) => {
      globeCameraDistance = THREE.MathUtils.clamp(distance, 850, GLOBE_MAX_CAMERA_DISTANCE);
      globeCamera.position.copy(globeCameraStart).normalize().multiplyScalar(globeCameraDistance);
      globeCamera.lookAt(0, 0, 0);
    };
    const blockGlobeZoom = () => {
      if (globeBlockedZoomStartedAt) return;
      globeBlockedZoomOriginDistance = globeCameraDistance;
      globeBlockedZoomStartedAt = performance.now();
      inputController?.keepFullFrameRateUntil(performance.now() + BLOCKED_ZOOM_DURATION_MS);
    };
    const zoomGlobeOut = (requestedDistance: number) => {
      if (requestedDistance > GLOBE_MAX_CAMERA_DISTANCE) {
        blockGlobeZoom();
        return;
      }
      setGlobeCameraDistance(requestedDistance);
    };
    const cloudVeil = document.createElement("div");
    cloudVeil.className = "globe-cloud-transition";
    let globeTransitionStartedAt = 0;
    let globeTransitionLanded = false;
    let globeTransitionDirection: "in" | "out" | null = null;
    let globeTransitionCity: CityOverview = "manhattan";
    let reverseTransitionStartZoom = 0.3;
    const GLOBE_TRANSITION_DURATION_MS = 2168;

    const camera = new THREE.OrthographicCamera(-500, 500, 390, -390, 10, 3500);
    const overviewCameraTarget = MANHATTAN_CENTER.clone();
    const cameraTarget = overviewCameraTarget.clone();
    const desiredCameraTarget = cameraTarget.clone();
    let cameraHeight = MANHATTAN_CAMERA_HEIGHT;
    let cameraRadius = MANHATTAN_CAMERA_RADIUS;
    let cameraAzimuth = 0;
    let desiredCameraHeight = cameraHeight;
    let desiredCameraRadius = cameraRadius;
    let desiredCameraAzimuth = cameraAzimuth;
    let desiredCameraZoom = 0.3;
    camera.zoom = desiredCameraZoom;
    let cameraLocked = false, cameraTransitioning = false; const reportSettledView = createMapViewSettledReporter();
    let pendingAgentDestination: CameraViewId | null = null;
    let sanDiegoManuallyAdjusted = false;
    let navigateAgentCamera: (destination: CameraViewId, updateUrl?: boolean) => void = () => undefined;
    let selectLandmark: (landmark: ClickableLandmark, updateUrl?: boolean) => void = () => undefined;
    let blockedZoomStartedAt = 0;
    let blockedZoomGestureActive = false;
    let blockedZoomGestureReset = 0;
    let zoomOutGestureActive = false;
    let zoomOutGestureReset = 0;
    const blockedZoomOrigin = cameraTarget.clone();
    const blockedZoomFocus = cameraTarget.clone();
    let blockedZoomOriginZoom = camera.zoom;
    const authoredLandmarkTarget = new THREE.Vector3();
    const displayedCameraPose = () => ({ target: cameraTarget, azimuth: cameraAzimuth, height: cameraHeight, radius: cameraRadius, zoom: camera.zoom });
    const constrainDesiredCamera = () => {
      if (!isSanDiegoView(activeStudy) || !sanDiegoCoverage) return;
      const focus = activeStudy === "park-village" ? sanDiegoAnnotations.find(({ view }) => view === "park-village")?.anchor : undefined;
      const pose = constrainCameraToCoverage({ target: desiredCameraTarget, azimuth: desiredCameraAzimuth,
        height: desiredCameraHeight, radius: desiredCameraRadius, zoom: desiredCameraZoom }, camera, sanDiegoCoverage, focus);
      desiredCameraTarget.copy(pose.target);
      desiredCameraZoom = pose.zoom;
    };
    const updateCamera = () => {
      if (isSanDiegoView(activeStudy) && sanDiegoCoverage) {
        // Enforce the displayed frame too: interpolated poses and the globe's
        // temporary 0.91 exit zoom must never reveal an empty source edge.
        const pose = constrainCameraToCoverage(displayedCameraPose(), camera, sanDiegoCoverage);
        cameraTarget.copy(pose.target);
        camera.zoom = pose.zoom;
        Object.assign(camera, getCoverageDepthRange(pose, camera, sanDiegoCoverage));
        camera.updateProjectionMatrix();
      }
      camera.position.set(
        cameraTarget.x + Math.sin(cameraAzimuth) * cameraRadius,
        cameraHeight,
        cameraTarget.z + Math.cos(cameraAzimuth) * cameraRadius,
      );
      camera.lookAt(cameraTarget);
      camera.updateMatrixWorld(true);
    };
    const adjustSanDiegoCamera = (gesture: FreeCameraGesture) => {
      if (!SAN_DIEGO_FREE_CAMERA_ENABLED || !isSanDiegoView(activeStudy) || globeTransitionStartedAt) return;
      const pose = adjustFreeCamera(displayedCameraPose(), gesture, camera, { width: mount.clientWidth, height: mount.clientHeight });
      cameraTarget.copy(pose.target);
      desiredCameraTarget.copy(pose.target);
      cameraAzimuth = desiredCameraAzimuth = pose.azimuth;
      cameraHeight = desiredCameraHeight = pose.height;
      cameraRadius = desiredCameraRadius = pose.radius;
      camera.zoom = desiredCameraZoom = pose.zoom;
      cameraTransitioning = false;
      blockedZoomStartedAt = 0;
      pendingAgentDestination = null;
      sanDiegoManuallyAdjusted = true;
      camera.updateProjectionMatrix();
      updateCamera();
    };
    updateCamera();
    let requestNeighborhood: ((center: THREE.Vector3, radius: number) => void) | null = null;
    let navigationArrow: THREE.Group | null = null;
    let manhattanDestinationMarkers: THREE.Group | null = null;
    let washingtonDestinationMarker: THREE.Group | null = null;
    let unionDestinationMarker: THREE.Group | null = null;
    const neighborhoodBuildingMarkers = new Map<MapView, THREE.Group[]>([
      ["washington", []],
      ["union", []],
      ["san-diego", []],
      ["torrey-highlands", []],
    ]);
    let manhattanMarkerExitStartedAt = 0;
    let manhattanMarkerEnterStartedAt = 0;
    const manhattanMarkerDestinations = new Map<THREE.Object3D, "washington" | "union">();
    let navigationArrowSpringStartedAt = Number.POSITIVE_INFINITY;
    let navigationArrowSpringComplete = false;
    const getSanDiegoCamera = (view: MapView) => sanDiegoDistricts.get(view as SanDiegoDistrictView)?.camera ?? sanDiegoOverview;
    const getSanDiegoTarget = (view: MapView) => {
      const target = new THREE.Vector3(...getSanDiegoCamera(view).target);
      if (view === "san-diego" && mount.clientWidth < mount.clientHeight) {
        const highlands = sanDiegoDistricts.get("torrey-highlands");
        const parkVillage = sanDiegoDistricts.get("park-village");
        if (highlands && parkVillage) target.x = (highlands.markerPosition[0] + parkVillage.markerPosition[0]) / 2;
      }
      return target;
    };
    switchStudyRef.current = (next, updateUrl = true) => {
      if (isSanDiegoView(next) && !sanDiegoReady) {
        void ensureSanDiego().then((ready) => { if (ready && !disposed) switchStudyRef.current(next, updateUrl); });
        return;
      }
      const previousStudy = activeStudy;
      activeStudy = next;
      sanDiegoManuallyAdjusted = false;
      if (!isSanDiegoView(next)) { camera.near = 10; camera.far = 3500; }
      camera.updateProjectionMatrix();
      scene.visible = !isSanDiegoView(next);
      sanDiegoScene.visible = isSanDiegoView(next);
      clickableLandmarks.forEach((landmark) => { landmark.selected = false; landmark.hovered = false; });
      renderer.shadowMap.needsUpdate = true;
      setCurrentView(next);
      if (next === "globe") {
        if (globeTransitionDirection !== "out") {
          globeTransitionStartedAt = 0;
          globeTransitionLanded = false;
          globeTransitionDirection = null;
          cloudVeil.style.opacity = "0";
          globeCamera.position.copy(globeCameraStart);
          globeCamera.lookAt(0, 0, 0);
        }
        scene.fog = null;
        cameraLocked = false;
        cameraTransitioning = false;
        if (updateUrl) window.history.pushState({ study: next }, "", "/");
        return;
      }
      const isManhattan = next === "manhattan";
      const isSanDiego = isSanDiegoView(next);
      const sanDiegoCamera = getSanDiegoCamera(next);
      const nextCenter = isSanDiego ? getSanDiegoTarget(next) : next === "union"
        ? UNION_CENTER
        : next === "washington" ? WASHINGTON_CENTER : MANHATTAN_CENTER;
      clickableLandmarks.forEach((landmark) => {
        landmark.selected = false;
        landmark.hovered = false;
        const cameraView = getCameraView(landmark.cameraViewId);
        landmark.glow.visible = cameraView?.kind === "landmark" && cameraView.neighborhood === next;
      });
      desiredCameraTarget.copy(nextCenter);
      desiredCameraAzimuth = isSanDiego ? sanDiegoCamera.azimuth ?? 0 : 0;
      desiredCameraHeight = isSanDiego ? sanDiegoCamera.height : isManhattan ? MANHATTAN_CAMERA_HEIGHT : 560;
      desiredCameraRadius = isSanDiego ? sanDiegoCamera.radius : isManhattan ? MANHATTAN_CAMERA_RADIUS : 630;
      desiredCameraZoom = isSanDiego ? sanDiegoCamera.zoom : isManhattan ? 0.3 : 1;
      constrainDesiredCamera();
      if (isSanDiego) {
        const districtBounds = sanDiegoDistrictBounds.get(next as SanDiegoDistrictView);
        const extent = next === "torrey-highlands" ? 1600 : districtBounds
          ? Math.max(1600, (districtBounds.max.x - districtBounds.min.x) / 2, (districtBounds.max.z - districtBounds.min.z) / 2)
          : 1600;
        sanDiegoSun.target.position.copy(nextCenter);
        sanDiegoSun.position.copy(nextCenter).add(new THREE.Vector3(-900, 1800, 800).multiplyScalar(extent / 1600));
        sanDiegoSun.castShadow = next !== "san-diego";
        sanDiegoSun.shadow.normalBias = 0.8 * extent / 1600;
        Object.assign(sanDiegoSun.shadow.camera, { left: -extent, right: extent, top: extent, bottom: -extent, far: 5000 * extent / 1600 });
        sanDiegoSun.shadow.camera.updateProjectionMatrix();
      }
      scene.fog = isManhattan ? null : new THREE.Fog(0x354345, 920, 1700);
      cameraLocked = false;
      cameraTransitioning = true;
      blockedZoomStartedAt = 0;
      if (navigationArrow) {
        navigationArrow.visible = !isManhattan && !isSanDiego;
        navigationArrow.position.x = next === "union" ? UNION_ARROW_POSITION.x : WASHINGTON_ARROW_POSITION.x;
        navigationArrow.position.z = next === "union" ? UNION_ARROW_POSITION.y : WASHINGTON_ARROW_POSITION.y;
        navigationArrow.rotation.y = next === "union" ? Math.PI - 0.754 : -0.754;
      }
      if (manhattanDestinationMarkers) {
        if (isManhattan) {
          manhattanMarkerExitStartedAt = 0;
          manhattanMarkerEnterStartedAt = previousStudy === "washington" || previousStudy === "union"
            ? performance.now()
            : 0;
          manhattanDestinationMarkers.visible = true;
          manhattanDestinationMarkers.traverse((object) => {
            if (object instanceof THREE.Sprite) object.material.opacity = manhattanMarkerEnterStartedAt ? 0 : 1;
          });
        } else if (previousStudy === "manhattan") {
          manhattanMarkerEnterStartedAt = 0;
          manhattanMarkerExitStartedAt = performance.now();
          manhattanDestinationMarkers.visible = true;
        } else {
          manhattanDestinationMarkers.visible = false;
        }
      }
      neighborhoodBuildingMarkers.forEach((markers, view) => {
        markers.forEach((marker) => { marker.visible = next === view; });
      });
      sanDiegoAnnotations.forEach(({ root, view }) => { root.visible = next === view; });
      if (!isManhattan && !isSanDiego && !neighborhoodBirdsLoaded) {
        skyTravelers.push(...createNeighborhoodBirdTravelers(scene));
        neighborhoodBirdsLoaded = true;
      }
      if (!isSanDiego) requestNeighborhood?.(nextCenter, isManhattan ? MANHATTAN_TILE_RADIUS : NEIGHBORHOOD_TILE_RADIUS);
      if (updateUrl) window.history.pushState({ study: next }, "", "/");
    };
    const handlePopState = (event: PopStateEvent) => {
      const destination = event.state?.view ?? event.state?.study ?? "globe";
      navigateAgentCamera(getCameraView(destination) ? destination : "globe", false);
    };
    window.addEventListener("popstate", handlePopState);
    const handleAgentCommand = (event: Event) => {
      const command = (event as CustomEvent<AgentCommand>).detail;
      if (command?.type === "navigate_map") navigateAgentCamera(command.destination);
    };
    window.addEventListener(AGENT_COMMAND_EVENT, handleAgentCommand);
    window.history.replaceState({ study: "globe" }, "", "/");

    const rendererState = createMapRenderer();
    const { renderer, minimumPixelRatio, maximumPixelRatio } = rendererState;
    let { activePixelRatio } = rendererState;

    scene.add(new THREE.HemisphereLight(0xfff4dc, 0x87908c, 1.9));
    navigationArrow = createWorldNavigationArrow();
    if (isUnion) {
      navigationArrow.position.set(UNION_ARROW_POSITION.x, NAVIGATION_ARROW_Y, UNION_ARROW_POSITION.y);
      navigationArrow.rotation.y = Math.PI - 0.754;
    }
    navigationArrow.visible = false;
    navigationArrow.scale.setScalar(0.001);
    scene.add(navigationArrow);
    manhattanDestinationMarkers = new THREE.Group();
    manhattanDestinationMarkers.name = "Manhattan neighborhood destination markers";
    washingtonDestinationMarker = createManhattanDestinationMarker(
      "washington",
    );
    washingtonDestinationMarker.position.set(WASHINGTON_PARK_VISUAL_CENTER.x, 8, WASHINGTON_PARK_VISUAL_CENTER.y);
    unionDestinationMarker = createManhattanDestinationMarker(
      "union",
    );
    unionDestinationMarker.position.set(UNION_PARK_VISUAL_CENTER.x, 8, UNION_PARK_VISUAL_CENTER.y);
    manhattanDestinationMarkers.add(washingtonDestinationMarker, unionDestinationMarker);
    manhattanDestinationMarkers.visible = false;
    manhattanMarkerDestinations.set(washingtonDestinationMarker, "washington");
    manhattanMarkerDestinations.set(unionDestinationMarker, "union");
    scene.add(manhattanDestinationMarkers);
    const sun = new THREE.DirectionalLight(0xffdca8, 1.4);
    sun.position.copy(parkCenter).add(new THREE.Vector3(-720, 1080, 460));
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = -560;
    sun.shadow.camera.right = 560;
    sun.shadow.camera.top = 560;
    sun.shadow.camera.bottom = -560;
    sun.shadow.bias = -0.00015;
    sun.shadow.radius = 6;
    scene.add(sun);
    let skyTravelers: SkyTraveler[] = [];
    let neighborhoodBirdsLoaded = false;
    const ambientAnimations: AmbientAnimation[] = [];
    const arrivingTiles: SpringArrival[] = [];
    const queueSpringArrival = (
      root: THREE.Object3D,
      delay = 0,
      rise = 34,
      fade = false,
      durationMs?: number,
    ) => {
      const materials: THREE.Material[] = [];
      root.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) return;
        object.updateMatrix();
        object.matrixAutoUpdate = false;
        if (!fade) return;
        for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
          material.transparent = fade;
          material.opacity = fade ? 0 : 1;
          material.depthWrite = !fade;
          materials.push(material);
        }
      });
      const targetY = root.position.y;
      root.matrixAutoUpdate = true;
      root.position.y = targetY - rise;
      root.visible = false;
      arrivingTiles.push({
        root,
        materials,
        startedAt: performance.now() + delay,
        distance: 0,
        rise,
        fade,
        targetY,
        durationMs,
      });
    };
    const clickableLandmarks: ClickableLandmark[] = [];
    const landmarkByRoot = new Map<THREE.Object3D, ClickableLandmark>();
    const raycastRoots: THREE.Object3D[] = [];
    const fittedLandmarkZoom = (landmark: ClickableLandmark, maximumZoom: number) => getLandmarkFitZoom({
      root: landmark.root,
      camera,
      target: desiredCameraTarget,
      azimuth: desiredCameraAzimuth,
      height: desiredCameraHeight,
      radius: desiredCameraRadius,
      maximumZoom,
    });
    const registerClickableLandmark = (root: THREE.Object3D, parent: THREE.Object3D = scene) => {
      const cameraView = getLandmarkCameraViewForRoot(root.name); if (!cameraView) throw new Error(`Interactive landmark ${root.name} has no registered camera view.`);
      const glow = createBuildingGlow(root);
      glow.visible = activeStudy === cameraView.neighborhood;
      root.add(glow);
      if (root.parent !== parent) parent.add(root);
      const landmark = { root, glow, cameraViewId: cameraView.id, baseY: root.position.y, hovered: false, selected: false };
      clickableLandmarks.push(landmark);
      landmarkByRoot.set(root, landmark);
      raycastRoots.push(root);
      renderer.shadowMap.needsUpdate = true;
      return landmark;
    };
    const addNeighborhoodBuildingMarker = (
      view: "washington" | "union" | "torrey-highlands",
      landmark: ClickableLandmark,
    ) => {
      landmark.root.updateWorldMatrix(true, true);
      const bounds = new THREE.Box3().setFromObject(landmark.root);
      const center = bounds.getCenter(new THREE.Vector3());
      const marker = createManhattanDestinationMarker(
        view === "torrey-highlands" ? "san-diego" : view,
        view === "torrey-highlands" ? 0.65 : 0.25,
      );
      marker.position.set(center.x, bounds.max.y - 4, center.z);
      marker.userData.baseY = marker.position.y;
      marker.visible = activeStudy === view;
      neighborhoodBuildingMarkers.get(view)?.push(marker);
      landmarkByRoot.set(marker, landmark);
      raycastRoots.push(marker);
      (isSanDiegoView(view) ? sanDiegoScene : scene).add(marker);
    };
    ensureSanDiego = () => {
      if (sanDiegoReady) return Promise.resolve(true);
      if (sanDiegoLoading) return sanDiegoLoading;
      let mountedGroup: THREE.Group | null = null;
      setStatus("Loading San Diego…");
      sanDiegoLoading = import("../san-diego/load-scene")
        .then(({ loadSanDiegoScene }) => loadSanDiegoScene({ signal: abortController.signal }))
        .then((loaded) => {
          if (disposed) { disposeSceneObjects([loaded.group]); return false; }
          const landmarkIds = new Set(loaded.landmarks.map((entry) => entry.cameraViewId));
          if (!landmarkIds.has("westview-high-school") || !landmarkIds.has("torrey-highlands-plaza")
            || loaded.landmarks.some((entry) => !(entry.root instanceof THREE.Mesh)
              || getLandmarkCameraViewForRoot(entry.root.name)?.id !== entry.cameraViewId)) {
            disposeSceneObjects([loaded.group]);
            throw new Error("San Diego is missing its merged, registered landmark roots.");
          }
          mountedGroup = loaded.group;
          sanDiegoScene.add(loaded.group);
          sanDiegoOverview = loaded.overview;
          sanDiegoCoverage = new THREE.Box3(new THREE.Vector3(...loaded.coverageBounds.min), new THREE.Vector3(...loaded.coverageBounds.max));
          for (const district of loaded.districts) {
            sanDiegoDistricts.set(district.id, district);
            sanDiegoDistrictBounds.set(district.id, new THREE.Box3(new THREE.Vector3(...district.bounds.min), new THREE.Vector3(...district.bounds.max)));
            const marker = createSanDiegoDistrictMarker(district.label);
            marker.position.set(...district.markerPosition);
            marker.userData.baseY = marker.position.y;
            marker.visible = false;
            sanDiegoDistrictMarkers.set(marker, district.id);
            neighborhoodBuildingMarkers.get("san-diego")?.push(marker);
            sanDiegoScene.add(marker);
          }
          for (const annotation of loaded.annotations) {
            const root = createSanDiegoLabel(annotation.label);
            root.position.set(...annotation.position);
            root.center.set(0.5, -0.6);
            root.visible = false;
            root.raycast = () => undefined;
            sanDiegoAnnotations.push({ root, view: annotation.view, anchor: root.position.clone() });
            sanDiegoScene.add(root);
          }
          for (const entry of loaded.landmarks) {
            const landmark = registerClickableLandmark(entry.root, loaded.group);
            addNeighborhoodBuildingMarker("torrey-highlands", landmark);
          }
          sanDiegoReady = true;
          renderer.shadowMap.needsUpdate = true;
          setStatus("");
          return true;
        }).catch((error) => {
          if (mountedGroup) {
            // A registration/label failure must leave a clean retry, just like a GLB failure.
            const roots = [mountedGroup, ...(neighborhoodBuildingMarkers.get("san-diego") ?? []),
              ...(neighborhoodBuildingMarkers.get("torrey-highlands") ?? []), ...sanDiegoAnnotations.map(({ root }) => root)];
            roots.forEach((root) => root.removeFromParent());
            disposeSceneObjects(roots);
            for (let index = raycastRoots.length - 1; index >= 0; index--) {
              const landmark = landmarkByRoot.get(raycastRoots[index]);
              if (landmark && isSanDiegoView(landmark.cameraViewId)) raycastRoots.splice(index, 1);
            }
            landmarkByRoot.forEach((landmark, root) => { if (isSanDiegoView(landmark.cameraViewId)) landmarkByRoot.delete(root); });
            for (let index = clickableLandmarks.length - 1; index >= 0; index--) {
              if (isSanDiegoView(clickableLandmarks[index].cameraViewId)) clickableLandmarks.splice(index, 1);
            }
            neighborhoodBuildingMarkers.set("san-diego", []);
            neighborhoodBuildingMarkers.set("torrey-highlands", []);
            sanDiegoDistrictMarkers.clear();
            sanDiegoDistrictBounds.clear();
            sanDiegoDistricts.clear();
            sanDiegoAnnotations.length = 0;
            sanDiegoCoverage = null;
          }
          if (!disposed && !isAbortError(error)) {
            console.error("[San Diego] Scene loading failed", error);
            setStatus("San Diego could not load. Select its globe marker to try again.");
          }
          sanDiegoLoading = null;
          return false;
        });
      return sanDiegoLoading;
    };
    const timer = new THREE.Timer();
    timer.connect(document);

    const sidewalkMaterial = new THREE.MeshStandardMaterial({
      color: 0xaaa9a1,
      roughness: 1,
      stencilWrite: true,
      stencilRef: 1,
      stencilFunc: THREE.NotEqualStencilFunc,
    });
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(5200, 5200), sidewalkMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.position.copy(parkCenter).setY(0.68);
    ground.receiveShadow = true;
    scene.add(ground);
    const hudsonWaterAndPier = createHudsonWaterAndPier();
    const eastRiverWaterAndPiers = createEastRiverWaterAndPiers();
    scene.add(hudsonWaterAndPier, eastRiverWaterAndPiers);
    const hudsonWater = hudsonWaterAndPier.children.find((child) => child.name.includes("Hudson River surface"));
    const eastRiverWater = eastRiverWaterAndPiers.children.find((child) => child.name.includes("East River surface"));
    // Land is present on frame zero. Both complete water surfaces then fade in
    // together at their final elevation; no fill or vertical plane crossing.
    const waterArrivalDelayMs = 260;
    const waterArrivalDurationMs = 260;
    const waterArrivalCompleteAt = performance.now() + waterArrivalDelayMs + waterArrivalDurationMs;
    if (hudsonWater) queueSpringArrival(hudsonWater, waterArrivalDelayMs, 0, true, waterArrivalDurationMs);
    if (eastRiverWater) queueSpringArrival(eastRiverWater, waterArrivalDelayMs, 0, true, waterArrivalDurationMs);
    const waterfrontArrivalDelayMs = waterArrivalDelayMs + waterArrivalDurationMs + 80;
    hudsonWaterAndPier.children
      .filter((child) => child !== hudsonWater)
      .forEach((child, index) => queueSpringArrival(child, waterfrontArrivalDelayMs + index * 35, 22));
    eastRiverWaterAndPiers.children
      .filter((child) => child !== eastRiverWater)
      .forEach((child, index) => queueSpringArrival(child, waterfrontArrivalDelayMs + 60 + index * 24, 22));

    startManhattanLoading({
      abortController,
      isDisposed: () => disposed,
      getActiveStudy: () => activeStudy,
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
      setStatus: (message) => { if (!isSanDiegoView(activeStudy) && globeTransitionCity !== "san-diego") setStatus(message); },
      queueSpringArrival,
      registerClickableLandmark,
      addNeighborhoodBuildingMarker,
      setRequestNeighborhood: (request) => { requestNeighborhood = request; },
      setSkyTravelers: (travelers) => { skyTravelers = travelers; },
      setNavigationArrowSpringStartedAt: (startedAt) => {
        navigationArrowSpringStartedAt = startedAt;
      },
    });

    const resize = () => {
      if (!mount.clientWidth || !mount.clientHeight) return;
      const referenceHeight = 546, referenceAspect = 1935 / 935, viewportAspect = mount.clientWidth / mount.clientHeight;
      const width = Math.min(referenceHeight * referenceAspect, referenceHeight * viewportAspect);
      const height = width / viewportAspect;
      camera.left = -width / 2;
      camera.right = width / 2;
      camera.top = height / 2;
      camera.bottom = -height / 2;
      camera.updateProjectionMatrix();
      if (isSanDiegoView(activeStudy) && !sanDiegoManuallyAdjusted) {
        if (cameraLocked) {
          const landmark = clickableLandmarks.find((candidate) => candidate.selected);
          const view = landmark && getCameraView(landmark.cameraViewId);
          if (landmark && view?.kind === "landmark") {
            desiredCameraTarget.copy(authoredLandmarkTarget);
            desiredCameraZoom = fittedLandmarkZoom(landmark, view.zoom);
          }
        } else {
          desiredCameraTarget.copy(getSanDiegoTarget(activeStudy));
          desiredCameraZoom = getSanDiegoCamera(activeStudy).zoom;
        }
        constrainDesiredCamera();
        if (sanDiegoReady) {
          // A settled resize adopts its safe framing before the next render;
          // an in-flight resize keeps its motion while constraining this frame.
          if (!cameraTransitioning && !globeTransitionStartedAt) {
            cameraTarget.copy(desiredCameraTarget);
            camera.zoom = desiredCameraZoom;
          }
          updateCamera();
          cameraTransitioning = true;
        }
      }
      const halfPixelWorld = 0.5 * width / (mount.clientWidth * 0.3);
      if (washingtonDestinationMarker) {
        washingtonDestinationMarker.position.x = WASHINGTON_PARK_VISUAL_CENTER.x + halfPixelWorld;
      }
      if (unionDestinationMarker) {
        unionDestinationMarker.position.x = UNION_PARK_VISUAL_CENTER.x + halfPixelWorld;
      }
      globeCamera.aspect = mount.clientWidth / mount.clientHeight;
      globeCamera.updateProjectionMatrix();
      renderer.setSize(mount.clientWidth, mount.clientHeight);
    };
    const recordRenderCost = createAdaptiveResolution({
      renderer,
      minimumPixelRatio,
      maximumPixelRatio,
      initialPixelRatio: activePixelRatio,
      resize,
      report: (pixelRatio, averageRenderMs) => {
        activePixelRatio = pixelRatio;
        logLoad("Adaptive resolution changed", { pixelRatio, averageRenderMs });
      },
    });
    const observer = new ResizeObserver(resize);
    observer.observe(mount);
    resize();
    // Do not expose the renderer's cleared backing buffer. Present the canvas
    // only after its first land-and-riverbed frame has been rendered.
    renderer.render(globeScene, globeCamera);
    mount.appendChild(renderer.domElement);
    mount.appendChild(cloudVeil);
    logLoad("Renderer ready", {
      pixelRatio: renderer.getPixelRatio(),
      viewport: `${mount.clientWidth}x${mount.clientHeight}`,
    });

    const viewportLifecycle = createViewportLifecycle({
      mount,
      timer,
      isDisposed: () => disposed,
      visibilityWaiters,
      requestFrame: () => requestAnimationFrame(animate),
      cancelFrame: (activeFrame) => cancelAnimationFrame(activeFrame),
    });
    const { shouldAnimate, startAnimation } = viewportLifecycle;

    const {
      globeDestinationAtPointer,
      landmarkAtPointer,
      navigationAtPointer,
      manhattanMarkerAtPointer,
      parkDestinationAtPointer,
      districtDestinationAtPointer,
      pointerPlane,
      pointerWorld,
      raycaster,
      updatePointerRay,
    } = createHitTesting({
      renderer,
      camera,
      globeCamera,
      globeMarkers,
      raycastRoots,
      landmarkByRoot,
      manhattanMarkerDestinations,
      sanDiegoDistrictMarkers,
      sanDiegoDistrictBounds,
      getActiveView: () => activeStudy,
      isGlobeTransitioning: () => globeTransitionStartedAt > 0,
      getNavigationArrow: () => navigationArrow,
      getDestinationMarkers: () => manhattanDestinationMarkers,
    });
    const enterCityFromGlobe = (destination: CityOverview, updateUrl = true) => {
      if (activeStudy !== "globe" || globeTransitionStartedAt) return;
      if (destination === "san-diego") {
        void ensureSanDiego().then((ready) => {
          if (ready || disposed || globeTransitionCity !== destination || globeTransitionDirection !== "in") return;
          globeTransitionStartedAt = 0;
          globeTransitionDirection = null;
          globeTransitionLanded = false;
          pendingAgentDestination = null;
          cloudVeil.style.opacity = "0";
          globe.quaternion.copy(globeHomeQuaternion);
          globeOrbitYaw = globeOrbitPitch = 0;
          setGlobeCameraDistance(GLOBE_START_CAMERA_DISTANCE);
        });
      }
      if (destination === "manhattan") setStatus("");
      mapAudio.playGlobeTransition();
      globeTransitionStartedAt = performance.now();
      globeTransitionDirection = "in";
      globeTransitionCity = destination;
      globeTransitionLanded = false;
      globeTransitionStartQuaternion.copy(globe.quaternion);
      globeTransitionTargetQuaternion.copy(cityGlobeQuaternions[destination]);
      if (updateUrl) window.history.pushState({ study: destination }, "", "/");
      renderer.domElement.style.cursor = "default";
    };
    const enterGlobeFromCity = (updateUrl = true) => {
      if ((activeStudy !== "manhattan" && activeStudy !== "san-diego") || globeTransitionStartedAt) return;
      mapAudio.playGlobeTransition();
      globeTransitionCity = activeStudy;
      globeTransitionTargetQuaternion.copy(cityGlobeQuaternions[activeStudy]);
      globeTransitionStartedAt = performance.now();
      globeTransitionDirection = "out";
      globeTransitionLanded = false;
      reverseTransitionStartZoom = camera.zoom;
      if (updateUrl) window.history.pushState({ study: "globe" }, "", "/");
      renderer.domElement.style.cursor = "default";
    };
    const advancePendingNavigation = () => {
      if (!pendingAgentDestination || globeTransitionStartedAt || cameraTransitioning) return;
      const current = clickableLandmarks.find((landmark) => landmark.selected)?.cameraViewId ?? activeStudy;
      const next = getNextNavigationView(current, pendingAgentDestination);
      if (!next) { pendingAgentDestination = null; return; }
      if (activeStudy === "globe") { enterCityFromGlobe(getCityOverview(next), false); return; }
      if (next === "globe") { enterGlobeFromCity(false); return; }
      const cameraView = getCameraView(next);
      if (cameraView?.kind === "landmark") {
        const landmark = clickableLandmarks.find((candidate) => candidate.cameraViewId === cameraView.id);
        if (landmark) selectLandmark(landmark, false);
      } else if (cameraView?.kind === "geographic") {
        switchStudyRef.current(cameraView.id, false);
        if (next === pendingAgentDestination) pendingAgentDestination = null;
      }
    };
    navigateAgentCamera = (destination, updateUrl = true) => {
      if (!getCameraView(destination)) return;
      if (destination === "globe" && activeStudy === "globe" && globeTransitionDirection === "in") {
        globeTransitionStartedAt = 0;
        globeTransitionDirection = null;
        globeTransitionLanded = false;
        cloudVeil.style.opacity = "0";
        globe.quaternion.copy(globeHomeQuaternion);
        globeOrbitYaw = globeOrbitPitch = 0;
        setGlobeCameraDistance(GLOBE_START_CAMERA_DISTANCE);
      }
      pendingAgentDestination = destination;
      if (updateUrl) window.history.pushState({ view: destination }, "", "/");
      advancePendingNavigation();
    };
    selectLandmark = (landmark, updateUrl = true) => {
      const cameraView = getCameraView(landmark.cameraViewId);
      if (!cameraView || cameraView.kind !== "landmark" || cameraView.neighborhood !== activeStudy) return;
      pendingAgentDestination = null;
      sanDiegoManuallyAdjusted = false;
      if (updateUrl) window.history.pushState({ view: cameraView.id }, "", "/");
      clickableLandmarks.forEach((candidate) => { candidate.selected = candidate === landmark; });
      landmark.root.updateWorldMatrix(true, true);
      const center = new THREE.Box3().setFromObject(landmark.root).getCenter(new THREE.Vector3());
      desiredCameraTarget.set(center.x, Math.max(18, center.y * 0.72), center.z);
      if (cameraView.targetOffset) desiredCameraTarget.add(new THREE.Vector3(...cameraView.targetOffset));
      desiredCameraAzimuth = cameraView.azimuth;
      desiredCameraHeight = cameraView.height;
      desiredCameraRadius = cameraView.radius;
      if (cameraView.elevationAngleOffset) {
        const originalElevation = Math.atan2(cameraView.height - desiredCameraTarget.y, desiredCameraRadius);
        desiredCameraHeight = desiredCameraTarget.y
          + Math.tan(originalElevation + cameraView.elevationAngleOffset) * desiredCameraRadius;
      }
      desiredCameraZoom = isSanDiegoView(activeStudy)
        ? fittedLandmarkZoom(landmark, cameraView.zoom)
        : cameraView.zoom;
      authoredLandmarkTarget.copy(desiredCameraTarget);
      constrainDesiredCamera();
      cameraLocked = true;
      cameraTransitioning = true;
      blockedZoomStartedAt = 0;
      setCurrentView(cameraView.id);
    };
    const clearLandmarkSelection = () => {
      pendingAgentDestination = null;
      switchStudyRef.current(activeStudy);
      renderer.domElement.style.cursor = "default";
    };
    freeCameraActionsRef.current = {
      reset: () => {
        if (!isSanDiegoView(activeStudy) || globeTransitionStartedAt) return;
        pendingAgentDestination = null;
        const selected = clickableLandmarks.find((landmark) => landmark.selected);
        if (selected) selectLandmark(selected, false);
        else switchStudyRef.current(activeStudy, false);
        setCameraCopyStatus("");
        setCameraCopyFallback("");
      },
      snapshot: () => isSanDiegoView(activeStudy)
        ? serializeFreeCamera(clickableLandmarks.find((landmark) => landmark.selected)?.cameraViewId ?? activeStudy, displayedCameraPose())
        : null,
    };

    const inputController = createInputController({
      renderer,
      clickableLandmarks,
      globeDestinationAtPointer,
      landmarkAtPointer,
      navigationAtPointer,
      manhattanMarkerAtPointer,
      parkDestinationAtPointer,
      districtDestinationAtPointer,
      getActiveView: () => activeStudy,
      getCameraLocked: () => cameraLocked,
      isFreeCameraEnabled: () => SAN_DIEGO_FREE_CAMERA_ENABLED && isSanDiegoView(activeStudy),
      orbitFreeCamera: (deltaX, deltaY) => adjustSanDiegoCamera({ kind: "orbit", deltaX, deltaY }),
      panFreeCamera: (deltaX, deltaY) => adjustSanDiegoCamera({ kind: "pan", deltaX, deltaY }),
      zoomFreeCamera: (delta) => adjustSanDiegoCamera({ kind: "zoom", delta }),
      isGlobeTransitioning: () => globeTransitionStartedAt > 0,
      getGlobeCameraDistance: () => globeCameraDistance,
      getFacingGlobeDestination: () => globeMarkerStates.find((entry) => entry.facing > 0.94)?.destination ?? null,
      enterCityFromGlobe,
      enterGlobeFromCity,
      blockGlobeZoom,
      zoomGlobeOut,
      rotateGlobe: (yaw, pitch) => {
        globeOrbitYaw += yaw;
        globeOrbitPitch = THREE.MathUtils.clamp(
          globeOrbitPitch + pitch,
          -THREE.MathUtils.degToRad(85),
          THREE.MathUtils.degToRad(85),
        );
        updateGlobeOrbit();
      },
      rotateNeighborhood: (deltaX) => {
        cameraAzimuth -= deltaX * 0.005;
        desiredCameraAzimuth = cameraAzimuth;
        updateCamera();
      },
      switchView: (view) => navigateAgentCamera(view),
      selectLandmark,
      clearLandmarkSelection,
      triggerBlockedZoom: (event) => {
        updatePointerRay(event);
        blockedZoomOrigin.copy(cameraTarget);
        blockedZoomOriginZoom = camera.zoom;
        if (raycaster.ray.intersectPlane(pointerPlane, pointerWorld)) {
          blockedZoomFocus.copy(pointerWorld).setY(cameraTarget.y);
        } else blockedZoomFocus.copy(cameraTarget);
        blockedZoomStartedAt = performance.now();
      },
    });

    let previousRender = 0;
    function animate(now = performance.now()) {
      if (!shouldAnimate()) {
        viewportLifecycle.markAnimationStopped();
        return;
      }
      frame = requestAnimationFrame(animate);
      viewportLifecycle.setFrame(frame);
      const interactionNeedsFullFrameRate = inputController.isDragging()
        || inputController.isGlobeDragging()
        || now < inputController.getInteractionFullRateUntil()
        || cameraTransitioning
        || blockedZoomStartedAt > 0
        || globeTransitionStartedAt > 0;
      if (!interactionNeedsFullFrameRate && now - previousRender < 1000 / 30) return;
      previousRender = now;
      timer.update();
      const delta = Math.min(timer.getDelta(), 0.05);
      const elapsed = timer.getElapsed();
      const interactionEase = 1 - Math.exp(-delta * 9);
      if (activeStudy === "globe") {
        animateGlobeClouds(globeClouds, delta, globeCloudLocalDown, globeCloudInward);
        animateGlobeTravelers(globeTravelers, delta, elapsed);
        if (!globeTransitionStartedAt && !inputController.isGlobeDragging()) {
          globeOrbitYaw += delta * 0.018;
          updateGlobeOrbit();
        }
      }
      globeCameraDirection.copy(globeCamera.position).normalize();
      for (const entry of globeMarkerStates) {
        entry.marker.getWorldPosition(markerWorldPosition);
        entry.facing = markerWorldPosition.normalize().dot(globeCameraDirection);
        const opacity = THREE.MathUtils.smoothstep(entry.facing, 0.3, 0.52);
        entry.markerMaterials.forEach((material) => { material.opacity = opacity; });
        const leaderOpacity = THREE.MathUtils.smoothstep(entry.facing, 0.5, 0.68);
        entry.leaderMaterials.forEach((material) => { material.opacity = opacity * leaderOpacity; });
        entry.marker.visible = opacity > 0.01;
      }
      if (globeBlockedZoomStartedAt) {
        const progress = Math.min(1, (now - globeBlockedZoomStartedAt) / BLOCKED_ZOOM_DURATION_MS);
        setGlobeCameraDistance(globeBlockedZoomOriginDistance * (1 - Math.sin(progress * Math.PI) * 0.025));
        if (progress >= 1) globeBlockedZoomStartedAt = 0;
      }
      if (globeTransitionStartedAt) {
        if (globeTransitionDirection === "in" && globeTransitionCity === "san-diego" && !sanDiegoReady) {
          // Keep the veil fully covered until decoded geometry and interaction roots are ready.
          globeTransitionStartedAt = Math.max(globeTransitionStartedAt, now - GLOBE_TRANSITION_DURATION_MS * 0.55);
        }
        const progress = THREE.MathUtils.clamp(
          (now - globeTransitionStartedAt) / GLOBE_TRANSITION_DURATION_MS,
          0,
          1,
        );
        const approachProgress = THREE.MathUtils.clamp(progress / 0.58, 0, 1);
        const approachEase = 1 - Math.pow(1 - approachProgress, 3);
        if (globeTransitionDirection === "out" && !globeTransitionLanded) {
          const zoomOutProgress = THREE.MathUtils.smoothstep(progress, 0, 0.3);
          camera.zoom = THREE.MathUtils.lerp(reverseTransitionStartZoom, reverseTransitionStartZoom * 0.91, zoomOutProgress);
          camera.updateProjectionMatrix();
          updateCamera();
        }
        if (globeTransitionDirection === "in" && !globeTransitionLanded) {
          globe.quaternion.copy(globeTransitionStartQuaternion).slerp(globeTransitionTargetQuaternion, approachEase);
          globeCamera.position.lerpVectors(globeCameraStart, globeCameraEnd, approachEase);
          globeCamera.lookAt(0, 0, THREE.MathUtils.lerp(0, GLOBE_RADIUS, approachEase * 0.9));
        } else if (globeTransitionDirection === "out" && globeTransitionLanded) {
          const retreatProgress = THREE.MathUtils.smoothstep(progress, 0.56, 1);
          globeCamera.position.lerpVectors(globeCameraEnd, globeCameraStart, retreatProgress);
          globeCamera.lookAt(0, 0, THREE.MathUtils.lerp(GLOBE_RADIUS * 0.9, 0, retreatProgress));
        }
        const cloudOpacity = globeTransitionLanded
          ? 1 - THREE.MathUtils.smoothstep(progress, 0.6, 0.98)
          : globeTransitionDirection === "out"
            ? THREE.MathUtils.smoothstep(progress, 0, 0.28)
            : THREE.MathUtils.smoothstep(progress, 0.08, 0.38);
        cloudVeil.style.opacity = cloudOpacity.toFixed(3);
        cloudVeil.style.setProperty("--cloud-travel", `${progress * 7}rem`);
        if (!globeTransitionLanded && progress >= 0.56) {
          globeTransitionLanded = true;
          if (globeTransitionDirection === "in") {
            switchStudyRef.current(globeTransitionCity, false);
            cameraTarget.copy(desiredCameraTarget);
            cameraAzimuth = desiredCameraAzimuth;
            cameraHeight = globeTransitionCity === "san-diego" ? desiredCameraHeight * 0.8 : 720;
            cameraRadius = globeTransitionCity === "san-diego" ? desiredCameraRadius * 0.8 : 680;
            camera.zoom = globeTransitionCity === "san-diego" ? desiredCameraZoom * 1.18 : 0.92;
            camera.updateProjectionMatrix();
            updateCamera();
            cameraTransitioning = true;
          } else {
            globeHomeQuaternion.copy(globeTransitionTargetQuaternion);
            globe.quaternion.copy(globeHomeQuaternion);
            globeOrbitYaw = 0;
            globeOrbitPitch = 0;
            globeCamera.position.copy(globeCameraEnd);
            globeCamera.lookAt(0, 0, GLOBE_RADIUS * 0.9);
            switchStudyRef.current("globe", false);
          }
        }
        if (progress >= 1) {
          const completedDirection = globeTransitionDirection;
          globeTransitionStartedAt = 0;
          globeTransitionLanded = false;
          globeTransitionDirection = null;
          cloudVeil.style.opacity = "0";
          if (completedDirection === "out") setGlobeCameraDistance(GLOBE_START_CAMERA_DISTANCE);
        }
      }
      advancePendingNavigation();
      animateLandmarks(clickableLandmarks, elapsed, interactionEase, renderer);
      if (cameraTransitioning) {
        cameraTarget.lerp(desiredCameraTarget, interactionEase);
        cameraAzimuth = THREE.MathUtils.lerp(cameraAzimuth, desiredCameraAzimuth, interactionEase);
        cameraHeight = THREE.MathUtils.lerp(cameraHeight, desiredCameraHeight, interactionEase);
        cameraRadius = THREE.MathUtils.lerp(cameraRadius, desiredCameraRadius, interactionEase);
        camera.zoom = THREE.MathUtils.lerp(camera.zoom, desiredCameraZoom, interactionEase);
        camera.updateProjectionMatrix();
        updateCamera();
        if (
          cameraTarget.distanceTo(desiredCameraTarget) < 0.05
          && Math.abs(cameraAzimuth - desiredCameraAzimuth) < 0.0005
          && Math.abs(cameraHeight - desiredCameraHeight) < 0.05
          && Math.abs(cameraRadius - desiredCameraRadius) < 0.05
          && Math.abs(camera.zoom - desiredCameraZoom) < 0.0005
        ) cameraTransitioning = false;
      }
      mapAudio.update({
        view: activeStudy,
        experienceStarted: experienceStartedRef.current,
        cameraLocked,
        cameraTransitioning,
        globeTransitioning: globeTransitionStartedAt > 0,
      });
      reportSettledView(!cameraTransitioning && !globeTransitionStartedAt && !pendingAgentDestination && (!isSanDiegoView(activeStudy) || sanDiegoReady) ? clickableLandmarks.find((landmark) => landmark.selected)?.cameraViewId ?? activeStudy : null);
      if (blockedZoomStartedAt) {
        const progress = Math.min(1, (now - blockedZoomStartedAt) / BLOCKED_ZOOM_DURATION_MS);
        const pulse = Math.sin(progress * Math.PI);
        camera.zoom = blockedZoomOriginZoom * (1 + pulse * (BLOCKED_ZOOM_SCALE - 1));
        cameraTarget.copy(blockedZoomOrigin).lerp(blockedZoomFocus, pulse * 0.035);
        camera.updateProjectionMatrix();
        updateCamera();
        if (progress >= 1) {
          camera.zoom = blockedZoomOriginZoom;
          cameraTarget.copy(blockedZoomOrigin);
          camera.updateProjectionMatrix();
          updateCamera();
          blockedZoomStartedAt = 0;
        }
      }
      animateTravelers(skyTravelers, activeStudy, delta, elapsed);
      navigationArrowSpringComplete = animateNavigationArrow(
        navigationArrow,
        activeStudy,
        now,
        elapsed,
        navigationArrowSpringStartedAt,
        navigationArrowSpringComplete,
      );
      const markerTiming = animateDestinationMarkers(
        manhattanDestinationMarkers,
        now,
        elapsed,
        manhattanMarkerExitStartedAt,
        manhattanMarkerEnterStartedAt,
      );
      manhattanMarkerExitStartedAt = markerTiming.exitStartedAt;
      manhattanMarkerEnterStartedAt = markerTiming.enterStartedAt;
      animateNeighborhoodMarkers(
        neighborhoodBuildingMarkers,
        activeStudy,
        elapsed,
        cameraLocked,
        interactionEase,
      );
      if (isSanDiegoView(activeStudy)) {
        updateCamera();
        constrainSanDiegoLabels(camera, renderer.domElement.clientWidth, renderer.domElement.clientHeight,
          sanDiegoDistrictMarkers, sanDiegoAnnotations, activeStudy, neighborhoodBuildingMarkers.get("torrey-highlands"));
      }
      ambientAnimations.forEach((animation) => animation.update(elapsed, now));
      animateArrivals(arrivingTiles, now, renderer);
      const renderStarted = performance.now();
      renderMapFrame(renderer, activeStudy, globeScene, globeCamera, isSanDiegoView(activeStudy) ? sanDiegoScene : scene, camera, skyOverlayScene);
      recordRenderCost(performance.now() - renderStarted);
    }
    startAnimation();

    return () => {
      disposed = true;
      // Do not abort the shared browser fetch signal during React/HMR teardown.
      // Some response/body promises owned by the browser can reject outside
      // the explicit async chain and surface as an unhandled AbortError. Every
      // async scene branch checks `disposed` before mounting decoded results,
      // so letting in-flight requests settle is safe and keeps cleanup quiet.
      for (const resolve of visibilityWaiters) resolve();
      visibilityWaiters.clear();
      observer.disconnect();
      viewportLifecycle.dispose();
      window.removeEventListener("popstate", handlePopState);
      window.removeEventListener(AGENT_COMMAND_EVENT, handleAgentCommand);
      inputController.dispose();
      disposeScenes(renderer, [scene, sanDiegoScene, globeScene, skyOverlayScene]);
      timer.dispose();
      mapAudio.dispose();
      cloudVeil.remove();
      switchStudyRef.current = () => undefined;
      freeCameraActionsRef.current = null;
    };
  }, []);

  return (
    <main className="washington-study">
      <div ref={mountRef} className="washington-study__viewport" />
      <AvatarCall currentView={currentView} experienceStarted={experienceStarted} />
      {showFreeCamera && (
        <aside className="san-diego-camera" aria-label="San Diego free camera controls">
          <strong>Free camera · temporary</strong>
          <p>Drag to orbit / tilt · Shift or right-drag to pan · Scroll to zoom</p>
          <p className="san-diego-camera__touch-help">Touch: one finger to orbit · two to pan / pinch</p>
          <div className="san-diego-camera__actions">
            <button type="button" onClick={() => freeCameraActionsRef.current?.reset()}>Reset view</button>
            <button type="button" onClick={() => void copyCameraView()}>Copy view</button>
          </div>
          <span role="status">{cameraCopyStatus}</span>
          {cameraCopyFallback && (
            <textarea aria-label="Camera view to copy" value={cameraCopyFallback} readOnly onFocus={(event) => event.currentTarget.select()} />
          )}
        </aside>
      )}
      {status && <div className="washington-study__loading">{status}</div>}
      <div className="washington-study__credit">
        <Link href="/blog">Blog</Link>
        <span aria-hidden="true"> · </span>
        <a href="https://sketchfab.com/3d-models/lowpoly-earth-5f6ea1111fda4cf6a7b36cf4ce200d1b" target="_blank" rel="noreferrer">
          Low Poly Planet Earth on Sketchfab
        </a>
        {" · "}
        <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">
          {isSanDiegoView(currentView)
            ? "Map3D · © OpenStreetMap contributors"
            : "NYC Open Data · © OpenStreetMap contributors"}
        </a>
      </div>
    </main>
  );
}
