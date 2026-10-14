import * as THREE from "three";
import type { MapView } from "./core";
import { getMapQualityProfile, type MapDeviceCapabilities } from "./quality-profile";

export interface MapRendererState {
  renderer: THREE.WebGLRenderer;
  minimumPixelRatio: number;
  maximumPixelRatio: number;
  activePixelRatio: number;
}

export function readMapDeviceCapabilities(): MapDeviceCapabilities {
  return {
    devicePixelRatio: window.devicePixelRatio,
    hardwareConcurrency: navigator.hardwareConcurrency,
    maxTouchPoints: navigator.maxTouchPoints,
    coarsePointer: window.matchMedia("(pointer: coarse)").matches,
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
  };
}

export function createMapRenderer(activeView: MapView = "globe"): MapRendererState {
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    powerPreference: "high-performance",
    stencil: true,
  });
  renderer.autoClear = false;
  const { minimumPixelRatio, maximumPixelRatio, initialPixelRatio: activePixelRatio } =
    getMapQualityProfile(activeView, readMapDeviceCapabilities());
  renderer.setPixelRatio(activePixelRatio);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.94;
  renderer.setClearColor(0x354345, 1);
  renderer.clear();
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.shadowMap.autoUpdate = false;
  renderer.shadowMap.needsUpdate = true;
  renderer.domElement.className = "washington-canvas is-ready";
  return { renderer, minimumPixelRatio, maximumPixelRatio, activePixelRatio };
}

export function renderMapFrame(
  renderer: THREE.WebGLRenderer,
  activeView: MapView,
  globeScene: THREE.Scene,
  globeCamera: THREE.Camera,
  mapScene: THREE.Scene,
  mapCamera: THREE.Camera,
  overlayScene: THREE.Scene,
) {
  renderer.clear(true, true, true);
  if (activeView === "globe") {
    renderer.render(globeScene, globeCamera);
    return;
  }
  renderer.render(mapScene, mapCamera);
  if (activeView !== "san-diego") {
    renderer.clearDepth();
    renderer.render(overlayScene, mapCamera);
  }
}
