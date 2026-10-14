import * as THREE from "three";
import { createManhattanDestinationMarker } from "../manhattan/navigation";
import type { GeographicMapView, SanDiegoDistrictView } from "@/agent/context/camera-views";

export function createSanDiegoDistrictMarker(label: string) {
  const marker = createManhattanDestinationMarker("san-diego", 0.45);
  marker.name = `${label} district destination`;
  return marker;
}

export function constrainSanDiegoMarkers(
  camera: THREE.OrthographicCamera,
  width: number,
  height: number,
  markers: Map<THREE.Object3D, SanDiegoDistrictView>,
  view: GeographicMapView,
  landmarkMarkers: THREE.Group[] = [],
) {
  if (!width || !height) return;
  const scale = (camera.right - camera.left) / (width * camera.zoom);
  const onScreen = (position: THREE.Vector3) => {
    const projected = position.clone().project(camera);
    return Math.abs(projected.x) < 0.99 && Math.abs(projected.y) < 0.99 && Math.abs(projected.z) <= 1;
  };
  markers.forEach((_, marker) => {
    marker.scale.setScalar(scale);
    marker.visible = view === "san-diego" && onScreen(marker.position);
  });
  landmarkMarkers.forEach((marker) => {
    if (marker.visible && !onScreen(marker.position)) marker.visible = false;
  });
}
