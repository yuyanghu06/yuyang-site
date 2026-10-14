/* eslint-disable max-lines */
"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import * as THREE from "three";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import AvatarCall from "../../avatar-call";
import { Point3, isAbortError, createLoadLogger, SkyTraveler, AmbientAnimation, BLOCKED_ZOOM_DURATION_MS, BLOCKED_ZOOM_SCALE, BLOCKED_ZOOM_GESTURE_SETTLE_MS, NAVIGATION_ARROW_Y, NAVIGATION_ARROW_SCALE, NAVIGATION_ARROW_SPRING_DURATION_MS, WASHINGTON_ARROW_POSITION, UNION_ARROW_POSITION, MANHATTAN_CENTER, WASHINGTON_CENTER, UNION_CENTER, WASHINGTON_PARK_VISUAL_CENTER, UNION_PARK_VISUAL_CENTER, MANHATTAN_TILE_RADIUS, NEIGHBORHOOD_TILE_RADIUS, PARK_ZOOM_HIT_RADIUS, MANHATTAN_CAMERA_HEIGHT, MANHATTAN_CAMERA_RADIUS, WORLD_UP, MapView, type CityOverview } from "../shared/core";
import { GLOBE_RADIUS, GLOBE_START_CAMERA_DISTANCE, GLOBE_MAX_CAMERA_DISTANCE, createWatercolorGlobe, createStarField, northUpGlobeQuaternion, IMPORTED_EARTH_SD_LATITUDE, IMPORTED_EARTH_SD_LONGITUDE } from "../globe/scene";
import { createManhattanDestinationMarker, ClickableLandmark, createBuildingGlow, createWorldNavigationArrow } from "../manhattan/navigation";
import { createNeighborhoodBirdTravelers, createGlobeClouds, createSkyTravelers } from "../manhattan/ambient/sky";
import { createMapRenderer, renderMapFrame, readMapDeviceCapabilities } from "../shared/rendering";
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
import { getMapQualityProfile } from "../shared/quality-profile";
import { disposeScenes, disposeSceneObjects } from "./dispose-runtime";
import { createHitTesting } from "../interaction/hit-testing";
import { createInputController } from "../interaction/input-controller";
import { createViewportLifecycle } from "./viewport-lifecycle";
import { getLandmarkFitZoom } from "./landmark-framing";
import { adjustFreeCamera, serializeFreeCamera, SAN_DIEGO_FREE_CAMERA_ENABLED, type FreeCameraGesture } from "./san-diego-free-camera";
import { AGENT_COMMAND_EVENT, createMapViewSettledReporter, type AgentCommand } from "@/agent/contracts/types";
import { getCameraView, getLandmarkCameraViewForRoot, type CameraViewId } from "@/agent/context/camera-views";
import { createMapAudioController } from "../../site-audio";
import { createSanDiegoLandmarkGlow } from "../san-diego/scene-resources";

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
    && (currentView === "san-diego" || currentView === "westview-high-school" || currentView === "torrey-highlands-plaza" || currentView === "mesa-verde-middle-school" || currentView === "deer-canyon-elementary-school");
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
    sanDiegoScene.name = "San Diego — Torrey Highlands";
    sanDiegoScene.background = new THREE.Color(0x9fb77f);
    sanDiegoScene.add(new THREE.HemisphereLight(0xfffcf2, 0x839975, 1.9));
    const sanDiegoSun = new THREE.DirectionalLight(0xfff0d9, 1.4);
    sanDiegoSun.position.set(-900, 1800, 800);
    sanDiegoSun.castShadow = true;
    sanDiegoSun.shadow.mapSize.set(2048, 2048);
    Object.assign(sanDiegoSun.shadow.camera, { left: -1600, right: 1600, top: 1600, bottom: -1600, far: 5000 });
    sanDiegoSun.shadow.camera.updateProjectionMatrix();
    sanDiegoSun.shadow.bias = -0.00015;
    sanDiegoSun.shadow.radius = 6;
    // Hidden New York tile loads also dirty the shared renderer shadow map.
    // San Diego's fixed light only needs a redraw when its own casters move.
    sanDiegoSun.shadow.autoUpdate = false;
    sanDiegoSun.shadow.needsUpdate = true;
    sanDiegoScene.add(sanDiegoSun, sanDiegoSun.target);
    let sanDiegoOverview = { target: [0, 28, 0] as Point3, height: 1700, radius: 1700, zoom: 0.32 };
    let sanDiegoReady = false;
    let sanDiegoLoading: Promise<boolean> | null = null;
    let ensureSanDiego: () => Promise<boolean> = () => Promise.resolve(false);
    let manhattanReady = false;
    let manhattanLoading: Promise<boolean> | null = null;
    let ensureManhattan: () => Promise<boolean> = () => Promise.resolve(false);
    let navigationGeneration = 0;
    let applyQualityProfile = () => undefined;
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
    void fetch("/models/low-poly-planet-earth-e54e8607.glb", { signal: abortController.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Globe model failed (${response.status})`);
        return response.arrayBuffer();
      })
      .then((buffer) => new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(buffer, ""))
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
    const isCityRequestCurrent = (city: CityOverview) => {
      // A cancelled or superseded first load may still finish into its cache.
      // Only the destination the user is currently visiting owns status text.
      if (activeStudy !== "globe") return (activeStudy === "san-diego" ? "san-diego" : "manhattan") === city;
      if (globeTransitionStartedAt && globeTransitionDirection === "in") return globeTransitionCity === city;
      const view = pendingAgentDestination && getCameraView(pendingAgentDestination);
      const geographic = view && (view.kind === "landmark" ? view.neighborhood : view.id);
      return geographic && geographic !== "globe" && (geographic === "san-diego" ? "san-diego" : "manhattan") === city;
    };
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
    const updateCamera = () => {
      camera.position.set(
        cameraTarget.x + Math.sin(cameraAzimuth) * cameraRadius,
        cameraHeight,
        cameraTarget.z + Math.cos(cameraAzimuth) * cameraRadius,
      );
      camera.lookAt(cameraTarget);
    };
    const displayedCameraPose = () => ({ target: cameraTarget, azimuth: cameraAzimuth, height: cameraHeight, radius: cameraRadius, zoom: camera.zoom });
    const adjustSanDiegoCamera = (gesture: FreeCameraGesture) => {
      if (!SAN_DIEGO_FREE_CAMERA_ENABLED || activeStudy !== "san-diego" || globeTransitionStartedAt) return;
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
    const neighborhoodBuildingMarkers = new Map<"washington" | "union" | "san-diego", THREE.Group[]>([
      ["washington", []],
      ["union", []],
      ["san-diego", []],
    ]);
    let manhattanMarkerExitStartedAt = 0;
    let manhattanMarkerEnterStartedAt = 0;
    const manhattanMarkerDestinations = new Map<THREE.Object3D, "washington" | "union">();
    let navigationArrowSpringStartedAt = Number.POSITIVE_INFINITY;
    let navigationArrowSpringComplete = false;
    switchStudyRef.current = (next, updateUrl = true) => {
      const generation = ++navigationGeneration;
      if (next !== "globe" && (next === "san-diego" ? !sanDiegoReady : !manhattanReady)) {
        const prepare = next === "san-diego" ? ensureSanDiego : ensureManhattan;
        void prepare().then((ready) => { if (ready && !disposed && generation === navigationGeneration) switchStudyRef.current(next, updateUrl); });
        return;
      }
      const previousStudy = activeStudy;
      activeStudy = next;
      applyQualityProfile();
      sanDiegoManuallyAdjusted = false;
      camera.far = next === "san-diego" ? 12000 : 3500;
      camera.updateProjectionMatrix();
      scene.visible = next !== "san-diego";
      sanDiegoScene.visible = next === "san-diego";
      if (next === "san-diego") sanDiegoSun.shadow.needsUpdate = true;
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
      const isSanDiego = next === "san-diego";
      const nextCenter = isSanDiego ? new THREE.Vector3(...sanDiegoOverview.target) : next === "union"
        ? UNION_CENTER
        : next === "washington" ? WASHINGTON_CENTER : MANHATTAN_CENTER;
      clickableLandmarks.forEach((landmark) => {
        landmark.selected = false;
        landmark.hovered = false;
        const cameraView = getCameraView(landmark.cameraViewId);
        landmark.glow.visible = cameraView?.kind === "landmark" && cameraView.neighborhood === next;
      });
      desiredCameraTarget.copy(nextCenter);
      desiredCameraAzimuth = 0;
      desiredCameraHeight = isSanDiego ? sanDiegoOverview.height : isManhattan ? MANHATTAN_CAMERA_HEIGHT : 560;
      desiredCameraRadius = isSanDiego ? sanDiegoOverview.radius : isManhattan ? MANHATTAN_CAMERA_RADIUS : 630;
      desiredCameraZoom = isSanDiego ? sanDiegoOverview.zoom : isManhattan ? 0.3 : 1;
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
    let qualityProfile = getMapQualityProfile(activeStudy, readMapDeviceCapabilities());
    let qualityView: MapView = activeStudy;

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
    const sanDiegoAnimations: AmbientAnimation[] = [];
    let sanDiegoRevealAt = Number.POSITIVE_INFINITY;
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
    const newYorkLandmarks: ClickableLandmark[] = [];
    const sanDiegoLandmarks: ClickableLandmark[] = [];
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
      const isSanDiego = cameraView.neighborhood === "san-diego";
      if (isSanDiego && !(root instanceof THREE.Mesh)) throw new Error("San Diego landmarks must be merged meshes.");
      const glow = isSanDiego ? createSanDiegoLandmarkGlow(root as THREE.Mesh) : createBuildingGlow(root);
      glow.visible = activeStudy === cameraView.neighborhood;
      root.add(glow);
      if (root.parent !== parent) parent.add(root);
      const landmark = { root, glow, cameraViewId: cameraView.id, baseY: root.position.y, hovered: false, selected: false };
      clickableLandmarks.push(landmark);
      (isSanDiego ? sanDiegoLandmarks : newYorkLandmarks).push(landmark);
      landmarkByRoot.set(root, landmark);
      raycastRoots.push(root);
      if (activeStudy === cameraView.neighborhood) renderer.shadowMap.needsUpdate = true;
      return landmark;
    };
    const addNeighborhoodBuildingMarker = (
      view: "washington" | "union" | "san-diego",
      landmark: ClickableLandmark,
    ) => {
      landmark.root.updateWorldMatrix(true, true);
      const bounds = new THREE.Box3().setFromObject(landmark.root);
      const center = bounds.getCenter(new THREE.Vector3());
      const marker = createManhattanDestinationMarker(
        view,
        view === "san-diego" ? 0.65 : 0.25,
      );
      marker.position.set(center.x, bounds.max.y - 4, center.z);
      marker.userData.baseY = marker.position.y;
      marker.visible = activeStudy === view;
      neighborhoodBuildingMarkers.get(view)?.push(marker);
      landmarkByRoot.set(marker, landmark);
      raycastRoots.push(marker);
      (view === "san-diego" ? sanDiegoScene : scene).add(marker);
    };
    ensureSanDiego = () => {
      if (sanDiegoReady) return Promise.resolve(true);
      if (sanDiegoLoading) return sanDiegoLoading;
      mapAudio.prepareSanDiego();
      setStatus("");
      sanDiegoLoading = import("../san-diego/load-scene")
        .then(({ loadSanDiegoScene }) => disposed ? null : loadSanDiegoScene({ signal: abortController.signal }))
        .then((loaded) => {
          if (!loaded) return false;
          if (disposed) { disposeSceneObjects([loaded.group]); return false; }
          const landmarkIds = new Set(loaded.landmarks.map((entry) => entry.cameraViewId));
          if (!landmarkIds.has("westview-high-school") || !landmarkIds.has("torrey-highlands-plaza")
            || !landmarkIds.has("mesa-verde-middle-school") || !landmarkIds.has("deer-canyon-elementary-school")
            || loaded.landmarks.some((entry) => !(entry.root instanceof THREE.Mesh)
              || getLandmarkCameraViewForRoot(entry.root.name)?.id !== entry.cameraViewId)) {
            disposeSceneObjects([loaded.group]);
            throw new Error("San Diego is missing its merged, registered landmark roots.");
          }
          const landmarkStart = clickableLandmarks.length;
          const raycastStart = raycastRoots.length;
          const animationStart = sanDiegoAnimations.length;
          const markers = neighborhoodBuildingMarkers.get("san-diego")!;
          const markerStart = markers.length;
          try {
            sanDiegoAnimations.push(...loaded.createPopulation(() => activeStudy === "san-diego", () => sanDiegoRevealAt));
            sanDiegoScene.add(loaded.group);
            for (const entry of loaded.landmarks) {
              const landmark = registerClickableLandmark(entry.root, loaded.group);
              addNeighborhoodBuildingMarker("san-diego", landmark);
            }
          } catch (error) {
            // Retry starts clean even if population or a canvas marker failed midway.
            const failedMarkers = markers.splice(markerStart);
            for (const root of raycastRoots.splice(raycastStart)) landmarkByRoot.delete(root);
            clickableLandmarks.splice(landmarkStart);
            sanDiegoLandmarks.length = 0;
            sanDiegoAnimations.splice(animationStart);
            loaded.group.removeFromParent();
            failedMarkers.forEach((marker) => marker.removeFromParent());
            disposeSceneObjects([loaded.group, ...failedMarkers]);
            throw error;
          }
          sanDiegoOverview = loaded.overview;
          sanDiegoReady = true;
          sanDiegoSun.shadow.needsUpdate = true;
          if (activeStudy === "san-diego") renderer.shadowMap.needsUpdate = true;
          if (isCityRequestCurrent("san-diego")) setStatus("");
          return true;
        }).catch((error) => {
          if (!disposed && !isAbortError(error)) {
            console.error("[San Diego] Scene loading failed", error);
            if (isCityRequestCurrent("san-diego")) setStatus("San Diego could not load. Select its globe marker to try again.");
          }
          sanDiegoLoading = null;
          return false;
        });
      return sanDiegoLoading;
    };
    const timer = new THREE.Timer();
    timer.connect(document);

    ensureManhattan = () => {
      if (manhattanReady) return Promise.resolve(true);
      if (manhattanLoading) return manhattanLoading;
      mapAudio.prepareManhattan();
      setStatus("");
      const loadController = new AbortController();
      const abortLoad = () => loadController.abort();
      abortController.signal.addEventListener("abort", abortLoad, { once: true });
      const existingRoots = new Set(scene.children);
      const existingOverlayRoots = new Set(skyOverlayScene.children);
      const existingArrivals = new Set(arrivingTiles);
      const animationStart = ambientAnimations.length;
      const rollback = () => {
        const failedRoots = scene.children.filter((root) => !existingRoots.has(root));
        const failedOverlayRoots = skyOverlayScene.children.filter((root) => !existingOverlayRoots.has(root));
        for (const view of ["washington", "union"] as const) {
          for (const marker of neighborhoodBuildingMarkers.get(view)!.splice(0)) {
            landmarkByRoot.delete(marker);
            const index = raycastRoots.indexOf(marker);
            if (index >= 0) raycastRoots.splice(index, 1);
          }
        }
        for (const landmark of newYorkLandmarks.splice(0)) {
          landmarkByRoot.delete(landmark.root);
          const pickIndex = raycastRoots.indexOf(landmark.root);
          if (pickIndex >= 0) raycastRoots.splice(pickIndex, 1);
          const landmarkIndex = clickableLandmarks.indexOf(landmark);
          if (landmarkIndex >= 0) clickableLandmarks.splice(landmarkIndex, 1);
        }
        for (let index = arrivingTiles.length - 1; index >= 0; index -= 1) {
          if (!existingArrivals.has(arrivingTiles[index])) arrivingTiles.splice(index, 1);
        }
        ambientAnimations.splice(animationStart);
        skyTravelers = [];
        requestNeighborhood = null;
        [...failedRoots, ...failedOverlayRoots].forEach((root) => root.removeFromParent());
        if (!disposed) disposeSceneObjects([...failedRoots, ...failedOverlayRoots]);
      };
      manhattanLoading = (async () => {
        try {
          const [{ startManhattanLoading }, { createHudsonWaterAndPier, createEastRiverWaterAndPiers }] = await Promise.all([
            import("../manhattan/loading/manhattan-loader"),
            import("../manhattan/waterfront"),
          ]);
          if (disposed) return false;
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

          const ready = await startManhattanLoading({
            abortController: loadController,
            isDisposed: () => disposed || loadController.signal.aborted,
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
            setStatus: (message) => { if (isCityRequestCurrent("manhattan")) setStatus(message); },
            queueSpringArrival,
            registerClickableLandmark,
            addNeighborhoodBuildingMarker,
            setRequestNeighborhood: (request) => { requestNeighborhood = request; },
            setSkyTravelers: (travelers) => { skyTravelers = travelers; },
            setNavigationArrowSpringStartedAt: (startedAt) => {
              navigationArrowSpringStartedAt = startedAt;
            },
          });

          if (!ready || disposed) {
            rollback();
            return false;
          }
          const registeredIds = new Set<string>(newYorkLandmarks.map((landmark) => landmark.cameraViewId));
          for (const id of ["lipton-hall", "courant-institute", "stern-school-of-business", "bobst-library", "25-union-square-west", "235-park-avenue-south"]) {
            if (!registeredIds.has(id)) throw new Error(`New York landmark ${id} did not load.`);
          }
          manhattanReady = true;
          if (isCityRequestCurrent("manhattan")) setStatus("");
          return true;
        } catch (error) {
          loadController.abort();
          rollback();
          if (!disposed && !isAbortError(error)) console.error("[New York] Scene loading failed", error);
          return false;
        }
      })().then((ready) => {
        if (!ready) {
          abortController.signal.removeEventListener("abort", abortLoad);
          manhattanLoading = null;
          if (!disposed && isCityRequestCurrent("manhattan")) setStatus("New York could not load. Select its globe marker to try again.");
        }
        return ready;
      });
      return manhattanLoading;
    };

    const resize = () => {
      if (!mount.clientWidth || !mount.clientHeight) return;
      applyQualityProfile();
      recordRenderCost.resetSamples();
      const referenceHeight = 546, referenceAspect = 1935 / 935, viewportAspect = mount.clientWidth / mount.clientHeight;
      const width = Math.min(referenceHeight * referenceAspect, referenceHeight * viewportAspect);
      const height = width / viewportAspect;
      camera.left = -width / 2;
      camera.right = width / 2;
      camera.top = height / 2;
      camera.bottom = -height / 2;
      camera.updateProjectionMatrix();
      if (activeStudy === "san-diego" && cameraLocked && !sanDiegoManuallyAdjusted) {
        const landmark = clickableLandmarks.find((candidate) => candidate.selected);
        const view = landmark && getCameraView(landmark.cameraViewId);
        if (landmark && view?.kind === "landmark") {
          desiredCameraZoom = fittedLandmarkZoom(landmark, view.zoom);
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
      resize: () => renderer.setSize(mount.clientWidth, mount.clientHeight),
      report: (pixelRatio, averageRenderMs) => {
        activePixelRatio = pixelRatio;
        logLoad("Adaptive resolution changed", { pixelRatio, averageRenderMs });
      },
    });
    applyQualityProfile = () => {
      const next = getMapQualityProfile(activeStudy, readMapDeviceCapabilities());
      const changed = qualityView !== activeStudy
        || next.minimumPixelRatio !== qualityProfile.minimumPixelRatio
        || next.maximumPixelRatio !== qualityProfile.maximumPixelRatio;
      if (changed) {
        qualityView = activeStudy;
        recordRenderCost.setLimits(next);
      }
      qualityProfile = next;
      if (sanDiegoSun.shadow.mapSize.x !== next.sanDiegoShadowMapSize) {
        // Release both render targets before changing dimensions; Three otherwise
        // retains an allocated target at its original size.
        sanDiegoSun.shadow.dispose();
        sanDiegoSun.shadow.map = null;
        sanDiegoSun.shadow.mapPass = null;
        sanDiegoSun.shadow.mapSize.set(next.sanDiegoShadowMapSize, next.sanDiegoShadowMapSize);
        sanDiegoSun.shadow.needsUpdate = true;
        renderer.shadowMap.needsUpdate = true;
      }
      return undefined;
    };
    const coarsePointerQuery = window.matchMedia("(pointer: coarse)");
    coarsePointerQuery.addEventListener("change", applyQualityProfile);
    window.addEventListener("resize", resize);
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
      getActiveView: () => activeStudy,
      isGlobeTransitioning: () => globeTransitionStartedAt > 0,
      getNavigationArrow: () => navigationArrow,
      getDestinationMarkers: () => manhattanDestinationMarkers,
    });
    const enterCityFromGlobe = (destination: CityOverview, updateUrl = true) => {
      if (activeStudy !== "globe" || globeTransitionStartedAt) return;
      {
        const prepare = destination === "san-diego" ? ensureSanDiego : ensureManhattan;
        void prepare().then((ready) => {
          if (ready || disposed || globeTransitionCity !== destination || globeTransitionDirection !== "in") return;
          globeTransitionStartedAt = 0;
          globeTransitionDirection = null;
          globeTransitionLanded = false;
          const pendingView = pendingAgentDestination && getCameraView(pendingAgentDestination);
          const pendingGeographic = pendingView && (pendingView.kind === "landmark" ? pendingView.neighborhood : pendingView.id);
          if (!pendingGeographic || pendingGeographic === "globe" || (pendingGeographic === "san-diego" ? "san-diego" : "manhattan") === destination) pendingAgentDestination = null;
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
    const cityForView = (view: MapView): CityOverview => view === "san-diego" ? "san-diego" : "manhattan";
    const advancePendingNavigation = () => {
      if (!pendingAgentDestination || globeTransitionStartedAt || cameraTransitioning) return;
      const cameraView = getCameraView(pendingAgentDestination);
      if (!cameraView) { pendingAgentDestination = null; return; }
      const geographic = cameraView.kind === "landmark" ? cameraView.neighborhood : cameraView.id;
      if (activeStudy === "globe") {
        if (geographic === "globe") { pendingAgentDestination = null; return; }
        enterCityFromGlobe(cityForView(geographic), false);
        return;
      }
      if (geographic === "globe" || cityForView(geographic) !== cityForView(activeStudy)) {
        const overview = cityForView(activeStudy);
        if (cameraLocked || activeStudy !== overview) switchStudyRef.current(overview, false);
        else enterGlobeFromCity(false);
        return;
      }
      if (activeStudy !== geographic) { switchStudyRef.current(geographic, false); return; }
      if (cameraView.kind === "landmark") {
        const landmark = clickableLandmarks.find((candidate) => candidate.cameraViewId === cameraView.id);
        if (!landmark) return; // The lazy scene must register its merged landmark before settling.
        pendingAgentDestination = null;
        selectLandmark(landmark, false);
      } else {
        pendingAgentDestination = null;
        if (cameraLocked || sanDiegoManuallyAdjusted) switchStudyRef.current(geographic, false);
      }
    };
    navigateAgentCamera = (destination, updateUrl = true) => {
      if (!getCameraView(destination)) return;
      navigationGeneration += 1;
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
      desiredCameraZoom = activeStudy === "san-diego"
        ? fittedLandmarkZoom(landmark, cameraView.zoom)
        : cameraView.zoom;
      cameraLocked = true;
      cameraTransitioning = true;
      blockedZoomStartedAt = 0;
      setCurrentView(cameraView.id);
    };
    const clearLandmarkSelection = () => {
      pendingAgentDestination = null;
      sanDiegoManuallyAdjusted = false;
      clickableLandmarks.forEach((landmark) => {
        landmark.selected = false;
        landmark.hovered = false;
      });
      desiredCameraTarget.copy(activeStudy === "san-diego"
        ? new THREE.Vector3(...sanDiegoOverview.target)
        : activeStudy === "union" ? UNION_CENTER : WASHINGTON_CENTER);
      desiredCameraAzimuth = 0;
      desiredCameraHeight = activeStudy === "san-diego" ? sanDiegoOverview.height : 560;
      desiredCameraRadius = activeStudy === "san-diego" ? sanDiegoOverview.radius : 630;
      desiredCameraZoom = activeStudy === "san-diego" ? sanDiegoOverview.zoom : 1;
      window.history.pushState({ study: activeStudy }, "", "/");
      cameraLocked = false;
      cameraTransitioning = true;
      blockedZoomStartedAt = 0;
      renderer.domElement.style.cursor = "default";
      setCurrentView(activeStudy);
    };
    freeCameraActionsRef.current = {
      reset: () => {
        if (activeStudy !== "san-diego" || globeTransitionStartedAt) return;
        pendingAgentDestination = null;
        const selected = clickableLandmarks.find((landmark) => landmark.selected);
        if (selected) selectLandmark(selected, false);
        else switchStudyRef.current("san-diego", false);
        setCameraCopyStatus("");
        setCameraCopyFallback("");
      },
      snapshot: () => activeStudy === "san-diego"
        ? serializeFreeCamera(clickableLandmarks.find((landmark) => landmark.selected)?.cameraViewId ?? "san-diego", displayedCameraPose())
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
      getActiveView: () => activeStudy,
      getCameraLocked: () => cameraLocked,
      isFreeCameraEnabled: () => SAN_DIEGO_FREE_CAMERA_ENABLED && activeStudy === "san-diego",
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
      switchView: (view) => switchStudyRef.current(view),
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
      const maximumFrameRate = interactionNeedsFullFrameRate ? qualityProfile.maximumFrameRate : 30;
      if (maximumFrameRate && now - previousRender + 0.5 < 1000 / maximumFrameRate) return;
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
      if (activeStudy === "globe") {
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
      }
      if (globeBlockedZoomStartedAt) {
        const progress = Math.min(1, (now - globeBlockedZoomStartedAt) / BLOCKED_ZOOM_DURATION_MS);
        setGlobeCameraDistance(globeBlockedZoomOriginDistance * (1 - Math.sin(progress * Math.PI) * 0.025));
        if (progress >= 1) globeBlockedZoomStartedAt = 0;
      }
      if (globeTransitionStartedAt) {
        if (globeTransitionDirection === "in" && !(globeTransitionCity === "san-diego" ? sanDiegoReady : manhattanReady)) {
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
      const landmarkShadowsChanged = animateLandmarks(activeStudy === "san-diego" ? sanDiegoLandmarks : newYorkLandmarks, elapsed, interactionEase, renderer);
      if (activeStudy === "san-diego" && landmarkShadowsChanged) sanDiegoSun.shadow.needsUpdate = true;
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
        selectedLandmark: clickableLandmarks.find((landmark) => landmark.selected)?.cameraViewId ?? null,
        experienceStarted: experienceStartedRef.current,
        cameraLocked,
        cameraTransitioning,
        globeTransitioning: globeTransitionStartedAt > 0,
      });
      reportSettledView(!cameraTransitioning && !globeTransitionStartedAt && !pendingAgentDestination && (activeStudy === "globe" || (activeStudy === "san-diego" ? sanDiegoReady : manhattanReady)) ? clickableLandmarks.find((landmark) => landmark.selected)?.cameraViewId ?? activeStudy : null);
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
      if (activeStudy !== "san-diego") {
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
        ambientAnimations.forEach((animation) => animation.update(elapsed, now));
        animateArrivals(arrivingTiles, now, renderer);
      }
      animateNeighborhoodMarkers(
        neighborhoodBuildingMarkers,
        activeStudy,
        elapsed,
        cameraLocked,
        interactionEase,
      );
      // Hidden city population needs no per-instance CPU or GPU updates.
      if (activeStudy === "san-diego") {
        if (!Number.isFinite(sanDiegoRevealAt)) sanDiegoRevealAt = now;
        sanDiegoAnimations.forEach((animation) => animation.update(elapsed, now));
      }
      const renderStarted = performance.now();
      renderMapFrame(renderer, activeStudy, globeScene, globeCamera, activeStudy === "san-diego" ? sanDiegoScene : scene, camera, skyOverlayScene);
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
      coarsePointerQuery.removeEventListener("change", applyQualityProfile);
      window.removeEventListener("resize", resize);
      viewportLifecycle.dispose();
      window.removeEventListener("popstate", handlePopState);
      window.removeEventListener(AGENT_COMMAND_EVENT, handleAgentCommand);
      inputController.dispose();
      sanDiegoSun.shadow.dispose();
      sun.shadow.dispose();
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
          {currentView === "san-diego" || currentView === "westview-high-school" || currentView === "torrey-highlands-plaza" || currentView === "mesa-verde-middle-school" || currentView === "deer-canyon-elementary-school"
            ? "Map3D · © OpenStreetMap contributors"
            : "NYC Open Data · © OpenStreetMap contributors"}
        </a>
      </div>
    </main>
  );
}
