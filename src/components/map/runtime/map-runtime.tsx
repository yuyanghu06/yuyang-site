"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { AMBIENT_LAYOUT } from "../../../generated/ambient-layout";
import AvatarCall from "../../avatar-call";
import { Point3, CityGmlSurface, WashingtonCityRuntimeData, WashingtonCityManifest, WashingtonParkData, SHARED_DATA_VERSION, isAbortError, createLoadLogger, SkyTraveler, AmbientAnimation, BLOCKED_ZOOM_DURATION_MS, BLOCKED_ZOOM_SCALE, BLOCKED_ZOOM_GESTURE_SETTLE_MS, NAVIGATION_ARROW_Y, NAVIGATION_ARROW_SCALE, NAVIGATION_ARROW_SPRING_DURATION_MS, WASHINGTON_ARROW_POSITION, UNION_ARROW_POSITION, MANHATTAN_CENTER, WASHINGTON_CENTER, UNION_CENTER, WASHINGTON_PARK_VISUAL_CENTER, UNION_PARK_VISUAL_CENTER, MANHATTAN_TILE_RADIUS, NEIGHBORHOOD_TILE_RADIUS, PARK_ZOOM_HIT_RADIUS, MANHATTAN_CAMERA_HEIGHT, MANHATTAN_CAMERA_RADIUS, HUDSON_MIN_CITY_TILE_X, WORLD_UP, MapView } from "../shared/core";
import { GLOBE_RADIUS, GLOBE_START_CAMERA_DISTANCE, GLOBE_MAX_CAMERA_DISTANCE, createWatercolorGlobe, createStarField } from "../globe/scene";
import { createManhattanDestinationMarker, ClickableLandmark, createBuildingGlow, createWorldNavigationArrow } from "../manhattan/navigation";
import { makeSurfaceGeometry, createParkPaths, createParkTrees, createSimpleFountain, createSimpleArch, loadGlb, loadBlenderArch, loadBobstLibrary, createCrosswalks } from "../manhattan/neighborhoods/park";
import { createNeighborhoodBirdTravelers, createGlobeClouds, createSkyTravelers } from "../manhattan/ambient/sky";
import { createPedestrians, createTraffic } from "../manhattan/ambient/street-life";
import { createInteractiveBuildingGroup, bakeLandmarkAsSingleMesh, createLandmarkDetails, createSternRotundaDetails, createGouldPlaza, createCourantGarden } from "../manhattan/neighborhoods/landmarks";
import { createHudsonWaterAndPier, createEastRiverWaterAndPiers } from "../manhattan/waterfront";
import { createMapRenderer, renderMapFrame } from "../shared/rendering";
import { animateGlobeClouds } from "../animation/globe-clouds";
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
import { disposeScenes } from "./dispose-runtime";

export default function GlobalMap() {
  const mountRef = useRef<HTMLDivElement>(null);
  const switchStudyRef = useRef<(next: MapView, updateUrl?: boolean) => void>(() => undefined);
  const [status, setStatus] = useState("");

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    let activeStudy: MapView = "globe";
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
      placeholder: globePlaceholder,
    } = createWatercolorGlobe();
    const globeClouds = createGlobeClouds();
    const globeCloudLocalDown = new THREE.Vector3(0, -1, 0);
    const globeCloudInward = new THREE.Vector3();
    globe.add(globeClouds);
    globeScene.add(globe);
    void loadGlb("/models/low-poly-planet-earth-e54e8607.glb", abortController.signal)
      .then((gltf) => {
        if (disposed) return;
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
    const manhattanMarkerMaterials: Array<THREE.MeshBasicMaterial | THREE.SpriteMaterial> = [];
    manhattanGlobeMarker.traverse((object) => {
      if (!(object instanceof THREE.Mesh || object instanceof THREE.Sprite)) return;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      materials.forEach((material) => {
        if (material instanceof THREE.MeshBasicMaterial || material instanceof THREE.SpriteMaterial) {
          manhattanMarkerMaterials.push(material);
        }
      });
    });
    const manhattanLeaderMaterials: THREE.LineBasicMaterial[] = [];
    manhattanGlobeLeader.traverse((object) => {
      if (!(object instanceof THREE.Line)) return;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      materials.forEach((material) => {
        if (material instanceof THREE.LineBasicMaterial) manhattanLeaderMaterials.push(material);
      });
    });
    const markerWorldPosition = new THREE.Vector3();
    const globeCameraDirection = new THREE.Vector3();
    let currentGlobeMarkerFacing = 1;
    const globeHomeQuaternion = globe.quaternion.clone();
    const globeTransitionStartQuaternion = globe.quaternion.clone();
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
      globeInteractionFullRateUntil = performance.now() + BLOCKED_ZOOM_DURATION_MS;
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
    let reverseTransitionStartZoom = 0.3;
    const GLOBE_TRANSITION_DURATION_MS = 1820;

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
    let cameraLocked = false;
    let cameraTransitioning = false;
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
    updateCamera();
    let requestNeighborhood: ((center: THREE.Vector3, radius: number) => void) | null = null;
    let navigationArrow: THREE.Group | null = null;
    let manhattanDestinationMarkers: THREE.Group | null = null;
    let washingtonDestinationMarker: THREE.Group | null = null;
    let unionDestinationMarker: THREE.Group | null = null;
    const neighborhoodBuildingMarkers = new Map<"washington" | "union", THREE.Group[]>([
      ["washington", []],
      ["union", []],
    ]);
    let manhattanMarkerExitStartedAt = 0;
    let manhattanMarkerEnterStartedAt = 0;
    const manhattanMarkerDestinations = new Map<THREE.Object3D, "washington" | "union">();
    let navigationArrowSpringStartedAt = Number.POSITIVE_INFINITY;
    let navigationArrowSpringComplete = false;
    switchStudyRef.current = (next, updateUrl = true) => {
      const previousStudy = activeStudy;
      activeStudy = next;
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
        if (updateUrl) window.history.pushState({ study: next }, "", "/");
        return;
      }
      const isManhattan = next === "manhattan";
      const nextCenter = next === "union"
        ? UNION_CENTER
        : next === "washington" ? WASHINGTON_CENTER : MANHATTAN_CENTER;
      clickableLandmarks.forEach((landmark) => {
        landmark.selected = false;
        landmark.hovered = false;
        landmark.glow.visible = !isManhattan;
      });
      desiredCameraTarget.copy(nextCenter);
      desiredCameraAzimuth = 0;
      desiredCameraHeight = isManhattan ? MANHATTAN_CAMERA_HEIGHT : 560;
      desiredCameraRadius = isManhattan ? MANHATTAN_CAMERA_RADIUS : 630;
      desiredCameraZoom = isManhattan ? 0.3 : 1;
      scene.fog = isManhattan ? null : new THREE.Fog(0xe8e4d9, 920, 1700);
      cameraLocked = false;
      cameraTransitioning = true;
      blockedZoomStartedAt = 0;
      if (navigationArrow) {
        navigationArrow.visible = !isManhattan;
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
      if (!isManhattan && !neighborhoodBirdsLoaded) {
        skyTravelers.push(...createNeighborhoodBirdTravelers(scene));
        neighborhoodBirdsLoaded = true;
      }
      requestNeighborhood?.(nextCenter, isManhattan ? MANHATTAN_TILE_RADIUS : NEIGHBORHOOD_TILE_RADIUS);
      if (updateUrl) window.history.pushState({ study: next }, "", "/");
    };
    const handlePopState = (event: PopStateEvent) => switchStudyRef.current(
      event.state?.study === "union"
        ? "union"
        : event.state?.study === "washington"
          ? "washington"
          : event.state?.study === "manhattan" ? "manhattan" : "globe",
      false,
    );
    window.addEventListener("popstate", handlePopState);
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
    const registerClickableLandmark = (root: THREE.Object3D) => {
      const glow = createBuildingGlow(root);
      glow.visible = activeStudy !== "manhattan";
      root.add(glow);
      scene.add(root);
      const landmark = { root, glow, baseY: root.position.y, hovered: false, selected: false };
      clickableLandmarks.push(landmark);
      landmarkByRoot.set(root, landmark);
      raycastRoots.push(root);
      renderer.shadowMap.needsUpdate = true;
      return landmark;
    };
    const addNeighborhoodBuildingMarker = (
      view: "washington" | "union",
      landmark: ClickableLandmark,
    ) => {
      landmark.root.updateWorldMatrix(true, true);
      const bounds = new THREE.Box3().setFromObject(landmark.root);
      const center = bounds.getCenter(new THREE.Vector3());
      const marker = createManhattanDestinationMarker(
        view,
        0.25,
      );
      marker.position.set(center.x, bounds.max.y - 4, center.z);
      marker.userData.baseY = marker.position.y;
      marker.visible = activeStudy === view;
      neighborhoodBuildingMarkers.get(view)?.push(marker);
      landmarkByRoot.set(marker, landmark);
      raycastRoots.push(marker);
      scene.add(marker);
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
      setStatus,
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
      const height = 546;
      const width = height * (mount.clientWidth / mount.clientHeight);
      camera.left = -width / 2;
      camera.right = width / 2;
      camera.top = height / 2;
      camera.bottom = -height / 2;
      camera.updateProjectionMatrix();
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

    let isIntersecting = true;
    let animationRunning = false;
    const shouldAnimate = () => isIntersecting && document.visibilityState === "visible" && !disposed;
    const startAnimation = () => {
      if (animationRunning || !shouldAnimate()) return;
      animationRunning = true;
      timer.reset();
      frame = requestAnimationFrame(animate);
    };
    const intersectionObserver = new IntersectionObserver(([entry]) => {
      isIntersecting = entry.isIntersecting;
      if (shouldAnimate()) startAnimation();
      else {
        cancelAnimationFrame(frame);
        animationRunning = false;
      }
    }, { threshold: 0.01 });
    intersectionObserver.observe(mount);
    const handleVisibility = () => {
      if (shouldAnimate()) {
        for (const resolve of visibilityWaiters) resolve();
        visibilityWaiters.clear();
        startAnimation();
      }
      else {
        cancelAnimationFrame(frame);
        animationRunning = false;
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const pointerPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const pointerWorld = new THREE.Vector3();
    const updatePointerRay = (event: { clientX: number; clientY: number }) => {
      const bounds = renderer.domElement.getBoundingClientRect();
      pointer.set(
        ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
        -((event.clientY - bounds.top) / bounds.height) * 2 + 1,
      );
      raycaster.setFromCamera(pointer, camera);
    };
    const globeManhattanAtPointer = (event: { clientX: number; clientY: number }) => {
      if (activeStudy !== "globe" || globeTransitionStartedAt) return false;
      const bounds = renderer.domElement.getBoundingClientRect();
      pointer.set(
        ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
        -((event.clientY - bounds.top) / bounds.height) * 2 + 1,
      );
      raycaster.setFromCamera(pointer, globeCamera);
      return raycaster.intersectObject(manhattanGlobeMarker, true).length > 0;
    };
    const enterManhattanFromGlobe = () => {
      if (activeStudy !== "globe" || globeTransitionStartedAt) return;
      globeTransitionStartedAt = performance.now();
      globeTransitionDirection = "in";
      globeTransitionLanded = false;
      globeTransitionStartQuaternion.copy(globe.quaternion);
      window.history.pushState({ study: "manhattan" }, "", "/");
      renderer.domElement.style.cursor = "default";
    };
    const enterGlobeFromManhattan = () => {
      if (activeStudy !== "manhattan" || globeTransitionStartedAt) return;
      globeTransitionStartedAt = performance.now();
      globeTransitionDirection = "out";
      globeTransitionLanded = false;
      reverseTransitionStartZoom = camera.zoom;
      window.history.pushState({ study: "globe" }, "", "/");
      renderer.domElement.style.cursor = "default";
    };
    const landmarkAtPointer = (event: { clientX: number; clientY: number }) => {
      if (activeStudy === "manhattan") return null;
      updatePointerRay(event);
      const intersections = raycaster.intersectObjects(raycastRoots, true);
      for (const intersection of intersections) {
        let object: THREE.Object3D | null = intersection.object;
        while (object) {
          const landmark = landmarkByRoot.get(object);
          if (landmark) return landmark;
          object = object.parent;
        }
      }
      return null;
    };
    const navigationAtPointer = (event: { clientX: number; clientY: number }) => {
      if (!navigationArrow || activeStudy === "manhattan") return false;
      updatePointerRay(event);
      return raycaster.intersectObject(navigationArrow, true).length > 0;
    };
    const manhattanMarkerAtPointer = (event: { clientX: number; clientY: number }): MapView | null => {
      if (!manhattanDestinationMarkers || activeStudy !== "manhattan") return null;
      updatePointerRay(event);
      const intersections = raycaster.intersectObject(manhattanDestinationMarkers, true);
      for (const intersection of intersections) {
        let object: THREE.Object3D | null = intersection.object;
        while (object && object !== manhattanDestinationMarkers) {
          const destination = manhattanMarkerDestinations.get(object);
          if (destination) return destination;
          object = object.parent;
        }
      }
      return null;
    };
    const parkDestinationAtPointer = (event: { clientX: number; clientY: number }): MapView | null => {
      if (activeStudy !== "manhattan") return null;
      updatePointerRay(event);
      if (!raycaster.ray.intersectPlane(pointerPlane, pointerWorld)) return null;
      const washingtonDistance = Math.hypot(pointerWorld.x - WASHINGTON_CENTER.x, pointerWorld.z - WASHINGTON_CENTER.z);
      const unionDistance = Math.hypot(pointerWorld.x - UNION_CENTER.x, pointerWorld.z - UNION_CENTER.z);
      if (washingtonDistance > PARK_ZOOM_HIT_RADIUS && unionDistance > PARK_ZOOM_HIT_RADIUS) return null;
      return washingtonDistance <= unionDistance ? "washington" : "union";
    };
    const selectLandmark = (landmark: ClickableLandmark) => {
      clickableLandmarks.forEach((candidate) => { candidate.selected = candidate === landmark; });
      landmark.root.updateWorldMatrix(true, true);
      const center = new THREE.Box3().setFromObject(landmark.root).getCenter(new THREE.Vector3());
      desiredCameraTarget.set(center.x, Math.max(18, center.y * 0.72), center.z);
      const isBobst = landmark.root.name.includes("Bobst");
      const isLipton = landmark.root.name.includes("Lipton");
      const isCourant = landmark.root.name.includes("Courant");
      const isStern = landmark.root.name.includes("Stern");
      const isGoldbelly = landmark.root.name.includes("25 Union Square West");
      const isUnionSquareCafe = landmark.root.name.includes("235 Park Avenue South");
      if (isCourant) desiredCameraTarget.add(new THREE.Vector3(-10, 0, -24));
      desiredCameraAzimuth = isCourant
        ? 0
        : isStern ? Math.PI / 2 + 0.42
          : isBobst ? Math.PI - 0.42
            : isGoldbelly ? Math.PI / 2 + 0.34
              : isUnionSquareCafe ? -Math.PI * 5 / 12 : 0;
      desiredCameraHeight = isLipton ? 273 : isStern ? 252 : isGoldbelly ? 160 : isUnionSquareCafe ? 235 : 210;
      desiredCameraRadius = isLipton ? 285 : isGoldbelly ? 270 : isUnionSquareCafe ? 330 : 365;
      if (isGoldbelly) {
        const originalElevation = Math.atan2(160 - desiredCameraTarget.y, desiredCameraRadius);
        desiredCameraHeight = desiredCameraTarget.y
          + Math.tan(originalElevation + Math.PI / 12) * desiredCameraRadius;
      }
      desiredCameraZoom = 2.41;
      cameraLocked = true;
      cameraTransitioning = true;
      blockedZoomStartedAt = 0;
    };
    const clearLandmarkSelection = () => {
      clickableLandmarks.forEach((landmark) => {
        landmark.selected = false;
        landmark.hovered = false;
      });
      desiredCameraTarget.set(
        activeStudy === "union" ? UNION_CENTER.x : WASHINGTON_CENTER.x,
        28,
        activeStudy === "union" ? UNION_CENTER.z : WASHINGTON_CENTER.z,
      );
      desiredCameraAzimuth = 0;
      desiredCameraHeight = 560;
      desiredCameraRadius = 630;
      desiredCameraZoom = 1;
      cameraLocked = false;
      cameraTransitioning = true;
      blockedZoomStartedAt = 0;
      renderer.domElement.style.cursor = "default";
    };

    let dragging = false;
    let globeDragging = false;
    const globeTouchPointers = new Map<number, { x: number; y: number }>();
    let globeTouchDistance = 0;
    let globeMultiTouchGesture = false;
    let globeInteractionFullRateUntil = 0;
    let pointerX = 0;
    let pointerY = 0;
    let pointerDownX = 0;
    let pointerDownY = 0;
    let pointerMoved = false;
    let lastPointerHitTestAt = Number.NEGATIVE_INFINITY;
    const pointerDown = (event: PointerEvent) => {
      dragging = !cameraLocked && activeStudy !== "manhattan" && activeStudy !== "globe";
      if (event.pointerType === "touch" && activeStudy === "globe" && !globeTransitionStartedAt) {
        globeTouchPointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
        globeDragging = true;
        if (globeTouchPointers.size >= 2) {
          const touches = [...globeTouchPointers.values()];
          globeTouchDistance = Math.hypot(touches[1].x - touches[0].x, touches[1].y - touches[0].y);
          globeMultiTouchGesture = true;
        }
      } else {
        globeDragging = activeStudy === "globe" && !globeTransitionStartedAt;
      }
      pointerX = event.clientX;
      pointerY = event.clientY;
      pointerDownX = event.clientX;
      pointerDownY = event.clientY;
      pointerMoved = false;
      renderer.domElement.setPointerCapture(event.pointerId);
      if (dragging || globeDragging) renderer.domElement.classList.add("is-dragging");
    };
    const pointerMove = (event: PointerEvent) => {
      if (activeStudy === "globe") globeInteractionFullRateUntil = performance.now() + 180;
      if (event.pointerType === "touch" && globeTouchPointers.has(event.pointerId)) {
        globeTouchPointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
        if (globeTouchPointers.size >= 2) {
          const touches = [...globeTouchPointers.values()];
          const touchDistance = Math.hypot(touches[1].x - touches[0].x, touches[1].y - touches[0].y);
          if (globeTouchDistance > 0 && touchDistance > 0) {
            const requestedDistance = globeCameraDistance * (globeTouchDistance / touchDistance);
            if (requestedDistance < globeCameraDistance) {
              if (currentGlobeMarkerFacing > 0.94) enterManhattanFromGlobe();
              else blockGlobeZoom();
            } else {
              zoomGlobeOut(requestedDistance);
            }
          }
          globeTouchDistance = touchDistance;
          pointerMoved = true;
          return;
        }
      }
      pointerMoved ||= Math.hypot(event.clientX - pointerDownX, event.clientY - pointerDownY) > 5;
      if (globeDragging) {
        const yaw = (event.clientX - pointerX) * 0.0045;
        const pitch = (event.clientY - pointerY) * 0.0032;
        globeOrbitYaw += yaw;
        globeOrbitPitch = THREE.MathUtils.clamp(
          globeOrbitPitch + pitch,
          -THREE.MathUtils.degToRad(85),
          THREE.MathUtils.degToRad(85),
        );
        updateGlobeOrbit();
        pointerX = event.clientX;
        pointerY = event.clientY;
        return;
      }
      if (dragging) {
        cameraAzimuth -= (event.clientX - pointerX) * 0.005;
        desiredCameraAzimuth = cameraAzimuth;
        pointerX = event.clientX;
        updateCamera();
        return;
      }
      // Pointer devices can dispatch substantially faster than the 30 FPS idle
      // render loop. Raycasting more often cannot produce a visible update.
      if (event.timeStamp - lastPointerHitTestAt < 1000 / 30) return;
      lastPointerHitTestAt = event.timeStamp;
      if (activeStudy === "globe") {
        renderer.domElement.style.cursor = globeManhattanAtPointer(event) ? "pointer" : "default";
        return;
      }
      const hovered = landmarkAtPointer(event);
      clickableLandmarks.forEach((landmark) => { landmark.hovered = landmark === hovered; });
      renderer.domElement.style.cursor = hovered
        || navigationAtPointer(event)
        || manhattanMarkerAtPointer(event)
        || parkDestinationAtPointer(event)
        ? "pointer"
        : "default";
    };
    const pointerUp = (event: PointerEvent) => {
      const endedMultiTouchGesture = globeMultiTouchGesture;
      if (event.pointerType === "touch") {
        globeTouchPointers.delete(event.pointerId);
        if (globeTouchPointers.size < 2) globeDragging = false;
        if (globeTouchPointers.size === 0) globeMultiTouchGesture = false;
      }
      if (!pointerMoved && !endedMultiTouchGesture) {
        if (globeManhattanAtPointer(event)) {
          enterManhattanFromGlobe();
          return;
        }
        const markerDestination = manhattanMarkerAtPointer(event);
        if (markerDestination) {
          switchStudyRef.current(markerDestination);
          return;
        }
        const parkDestination = parkDestinationAtPointer(event);
        if (parkDestination) {
          switchStudyRef.current(parkDestination);
          return;
        }
        if (navigationAtPointer(event)) {
          switchStudyRef.current(activeStudy === "union" ? "washington" : "union");
        }
        const landmark = landmarkAtPointer(event);
        if (landmark) selectLandmark(landmark);
      }
      dragging = false;
      if (event.pointerType !== "touch") globeDragging = false;
      if (renderer.domElement.hasPointerCapture(event.pointerId)) renderer.domElement.releasePointerCapture(event.pointerId);
      renderer.domElement.classList.remove("is-dragging");
    };
    renderer.domElement.addEventListener("pointerdown", pointerDown);
    renderer.domElement.addEventListener("pointermove", pointerMove);
    renderer.domElement.addEventListener("pointerup", pointerUp);
    renderer.domElement.addEventListener("pointercancel", pointerUp);
    const keyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && cameraLocked) clearLandmarkSelection();
    };
    const wheel = (event: WheelEvent) => {
      if (activeStudy === "globe") {
        event.preventDefault();
        globeInteractionFullRateUntil = performance.now() + 180;
        if (event.ctrlKey) {
          if (event.deltaY < 0) {
            if (globeManhattanAtPointer(event)) enterManhattanFromGlobe();
            else blockGlobeZoom();
          } else {
            zoomGlobeOut(globeCameraDistance * Math.exp(event.deltaY * 0.004));
          }
        } else if (event.deltaY < 0) {
          if (globeManhattanAtPointer(event)) enterManhattanFromGlobe();
          else blockGlobeZoom();
        } else if (!globeTransitionStartedAt) {
          zoomGlobeOut(globeCameraDistance * Math.exp(event.deltaY * 0.0025));
        }
        return;
      }
      if (event.deltaY > 0) {
        event.preventDefault();
        window.clearTimeout(zoomOutGestureReset);
        zoomOutGestureReset = window.setTimeout(() => {
          zoomOutGestureActive = false;
        }, BLOCKED_ZOOM_GESTURE_SETTLE_MS);
        if (zoomOutGestureActive) return;
        zoomOutGestureActive = true;
      }
      if (cameraLocked) {
        if (event.deltaY > 0) {
          clearLandmarkSelection();
        }
        return;
      }
      if (event.deltaY > 0) {
        if (activeStudy === "manhattan") enterGlobeFromManhattan();
        else switchStudyRef.current("manhattan");
        return;
      }
      if (event.deltaY >= 0) return;
      event.preventDefault();
      window.clearTimeout(blockedZoomGestureReset);
      blockedZoomGestureReset = window.setTimeout(() => {
        blockedZoomGestureActive = false;
      }, BLOCKED_ZOOM_GESTURE_SETTLE_MS);
      if (blockedZoomGestureActive) return;
      blockedZoomGestureActive = true;
      const parkDestination = parkDestinationAtPointer(event);
      if (parkDestination) {
        switchStudyRef.current(parkDestination);
        return;
      }
      const hovered = landmarkAtPointer(event);
      if (hovered) {
        selectLandmark(hovered);
        return;
      }
      updatePointerRay(event);
      blockedZoomOrigin.copy(cameraTarget);
      blockedZoomOriginZoom = camera.zoom;
      if (raycaster.ray.intersectPlane(pointerPlane, pointerWorld)) {
        blockedZoomFocus.copy(pointerWorld).setY(cameraTarget.y);
      } else {
        blockedZoomFocus.copy(cameraTarget);
      }
      blockedZoomStartedAt = performance.now();
    };
    window.addEventListener("keydown", keyDown);
    renderer.domElement.addEventListener("wheel", wheel, { passive: false });

    let previousRender = 0;
    function animate(now = performance.now()) {
      if (!shouldAnimate()) {
        animationRunning = false;
        return;
      }
      frame = requestAnimationFrame(animate);
      const interactionNeedsFullFrameRate = dragging
        || globeDragging
        || now < globeInteractionFullRateUntil
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
      }
      manhattanGlobeMarker.getWorldPosition(markerWorldPosition);
      globeCameraDirection.copy(globeCamera.position).normalize();
      const markerFacing = markerWorldPosition.normalize().dot(globeCameraDirection);
      currentGlobeMarkerFacing = markerFacing;
      const markerOpacity = THREE.MathUtils.smoothstep(markerFacing, 0.3, 0.52);
      manhattanMarkerMaterials.forEach((material) => { material.opacity = markerOpacity; });
      const leaderOpacity = THREE.MathUtils.smoothstep(markerFacing, 0.5, 0.68);
      manhattanLeaderMaterials.forEach((material) => { material.opacity = markerOpacity * leaderOpacity; });
      manhattanGlobeMarker.visible = markerOpacity > 0.01;
      if (globeBlockedZoomStartedAt) {
        const progress = Math.min(1, (now - globeBlockedZoomStartedAt) / BLOCKED_ZOOM_DURATION_MS);
        setGlobeCameraDistance(globeBlockedZoomOriginDistance * (1 - Math.sin(progress * Math.PI) * 0.025));
        if (progress >= 1) globeBlockedZoomStartedAt = 0;
      }
      if (globeTransitionStartedAt) {
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
          globe.quaternion.copy(globeTransitionStartQuaternion).slerp(globeHomeQuaternion, approachEase);
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
            switchStudyRef.current("manhattan", false);
            cameraHeight = 720;
            cameraRadius = 680;
            camera.zoom = 0.92;
            camera.updateProjectionMatrix();
            updateCamera();
            cameraTransitioning = true;
          } else {
            globe.quaternion.copy(globeHomeQuaternion);
            globeOrbitYaw = 0;
            globeOrbitPitch = 0;
            globeCamera.position.copy(globeCameraEnd);
            globeCamera.lookAt(0, 0, GLOBE_RADIUS * 0.9);
            switchStudyRef.current("globe", false);
          }
        }
        if (progress >= 1) {
          globeTransitionStartedAt = 0;
          globeTransitionLanded = false;
          globeTransitionDirection = null;
          cloudVeil.style.opacity = "0";
        }
      }
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
      ambientAnimations.forEach((animation) => animation.update(elapsed, now));
      animateArrivals(arrivingTiles, now, renderer);
      const renderStarted = performance.now();
      renderMapFrame(renderer, activeStudy, globeScene, globeCamera, scene, camera, skyOverlayScene);
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
      cancelAnimationFrame(frame);
      observer.disconnect();
      intersectionObserver.disconnect();
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("popstate", handlePopState);
      renderer.domElement.removeEventListener("pointerdown", pointerDown);
      renderer.domElement.removeEventListener("pointermove", pointerMove);
      renderer.domElement.removeEventListener("pointerup", pointerUp);
      renderer.domElement.removeEventListener("pointercancel", pointerUp);
      window.removeEventListener("keydown", keyDown);
      renderer.domElement.removeEventListener("wheel", wheel);
      window.clearTimeout(blockedZoomGestureReset);
      window.clearTimeout(zoomOutGestureReset);
      disposeScenes(renderer, [scene, globeScene, skyOverlayScene]);
      timer.dispose();
      cloudVeil.remove();
      switchStudyRef.current = () => undefined;
    };
  }, []);

  return (
    <main className="washington-study">
      <div ref={mountRef} className="washington-study__viewport" />
      <AvatarCall />
      {status && <div className="washington-study__loading">{status}</div>}
      <div className="washington-study__credit">
        <a href="https://sketchfab.com/3d-models/lowpoly-earth-5f6ea1111fda4cf6a7b36cf4ce200d1b" target="_blank" rel="noreferrer">
          Low Poly Planet Earth on Sketchfab
        </a>
        {" · "}
        <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">
          NYC Open Data · © OpenStreetMap contributors
        </a>
      </div>
    </main>
  );
}
