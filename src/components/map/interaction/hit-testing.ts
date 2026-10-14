import * as THREE from "three";
import {
  PARK_ZOOM_HIT_RADIUS,
  UNION_CENTER,
  WASHINGTON_CENTER,
  type MapView,
  type CityOverview,
} from "../shared/core";
import { getCameraView } from "@/agent/context/camera-views";
import type { ClickableLandmark } from "../manhattan/navigation";

export interface HitTestingOptions {
  renderer: THREE.WebGLRenderer;
  camera: THREE.Camera;
  globeCamera: THREE.Camera;
  globeMarkers: Map<CityOverview, THREE.Object3D>;
  raycastRoots: THREE.Object3D[];
  landmarkByRoot: Map<THREE.Object3D, ClickableLandmark>;
  manhattanMarkerDestinations: Map<THREE.Object3D, "washington" | "union">;
  getActiveView: () => MapView;
  isGlobeTransitioning: () => boolean;
  getNavigationArrow: () => THREE.Group | null;
  getDestinationMarkers: () => THREE.Group | null;
}

export function createHitTesting(options: HitTestingOptions) {
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const pointerPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const pointerWorld = new THREE.Vector3();
  const updatePointerRay = (event: { clientX: number; clientY: number }, globe = false) => {
    const bounds = options.renderer.domElement.getBoundingClientRect();
    pointer.set(
      ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
      -((event.clientY - bounds.top) / bounds.height) * 2 + 1,
    );
    raycaster.setFromCamera(pointer, globe ? options.globeCamera : options.camera);
  };
  const isVisible = (root: THREE.Object3D) => {
    for (let object: THREE.Object3D | null = root; object; object = object.parent) {
      if (!object.visible) return false;
    }
    return true;
  };
  const globeDestinationAtPointer = (event: { clientX: number; clientY: number }): CityOverview | null => {
    if (options.getActiveView() !== "globe" || options.isGlobeTransitioning()) return null;
    updatePointerRay(event, true);
    for (const [destination, marker] of options.globeMarkers) {
      if (isVisible(marker) && raycaster.intersectObject(marker, true).length > 0) return destination;
    }
    return null;
  };
  const landmarkAtPointer = (event: { clientX: number; clientY: number }) => {
    const view = options.getActiveView();
    if (view === "manhattan" || view === "globe" || options.isGlobeTransitioning()) return null;
    updatePointerRay(event);
    for (const intersection of raycaster.intersectObjects(options.raycastRoots.filter((root) => {
      const landmark = options.landmarkByRoot.get(root);
      const cameraView = landmark && getCameraView(landmark.cameraViewId);
      return isVisible(root) && cameraView?.kind === "landmark" && cameraView.neighborhood === view;
    }), true)) {
      let object: THREE.Object3D | null = intersection.object;
      while (object) {
        const landmark = options.landmarkByRoot.get(object);
        if (landmark) return landmark;
        object = object.parent;
      }
    }
    return null;
  };
  const navigationAtPointer = (event: { clientX: number; clientY: number }) => {
    const arrow = options.getNavigationArrow();
    const view = options.getActiveView();
    if (!arrow || !isVisible(arrow) || (view !== "washington" && view !== "union") || options.isGlobeTransitioning()) return false;
    updatePointerRay(event);
    return raycaster.intersectObject(arrow, true).length > 0;
  };
  const manhattanMarkerAtPointer = (event: { clientX: number; clientY: number }): MapView | null => {
    const markers = options.getDestinationMarkers();
    if (!markers || options.getActiveView() !== "manhattan") return null;
    updatePointerRay(event);
    for (const intersection of raycaster.intersectObject(markers, true)) {
      let object: THREE.Object3D | null = intersection.object;
      while (object && object !== markers) {
        const destination = options.manhattanMarkerDestinations.get(object);
        if (destination) return destination;
        object = object.parent;
      }
    }
    return null;
  };
  const parkDestinationAtPointer = (event: { clientX: number; clientY: number }): MapView | null => {
    if (options.getActiveView() !== "manhattan") return null;
    updatePointerRay(event);
    if (!raycaster.ray.intersectPlane(pointerPlane, pointerWorld)) return null;
    const washingtonDistance = Math.hypot(pointerWorld.x - WASHINGTON_CENTER.x, pointerWorld.z - WASHINGTON_CENTER.z);
    const unionDistance = Math.hypot(pointerWorld.x - UNION_CENTER.x, pointerWorld.z - UNION_CENTER.z);
    if (washingtonDistance > PARK_ZOOM_HIT_RADIUS && unionDistance > PARK_ZOOM_HIT_RADIUS) return null;
    return washingtonDistance <= unionDistance ? "washington" : "union";
  };
  return {
    globeDestinationAtPointer,
    landmarkAtPointer,
    navigationAtPointer,
    manhattanMarkerAtPointer,
    parkDestinationAtPointer,
    pointerPlane,
    pointerWorld,
    raycaster,
    updatePointerRay,
  };
}
