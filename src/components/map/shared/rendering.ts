import * as THREE from "three";

export interface MapRendererState {
  renderer: THREE.WebGLRenderer;
  minimumPixelRatio: number;
  maximumPixelRatio: number;
  activePixelRatio: number;
}

export function createMapRenderer(): MapRendererState {
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    powerPreference: "high-performance",
    stencil: true,
  });
  renderer.autoClear = false;
  const maximumPixelRatio = Math.min(
    window.devicePixelRatio,
    navigator.hardwareConcurrency <= 4 ? 1.5 : 2,
  );
  const minimumPixelRatio = Math.min(maximumPixelRatio, 1.5);
  const activePixelRatio = Math.min(window.devicePixelRatio, maximumPixelRatio);
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
  activeView: "globe" | "manhattan" | "washington" | "union",
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
  renderer.clearDepth();
  renderer.render(overlayScene, mapCamera);
}
