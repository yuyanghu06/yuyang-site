import * as THREE from "three";
import { createManhattanDestinationMarker } from "../manhattan/navigation";
import type { GeographicMapView, SanDiegoDistrictView } from "@/agent/context/camera-views";

/** World-space labels use the existing yellow destination-pin visual language. */
export function createSanDiegoLabel(label: string) {
  const canvas = document.createElement("canvas");
  canvas.width = 768;
  canvas.height = 112;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Could not create the San Diego label canvas");
  context.font = "600 46px system-ui, sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.lineJoin = "round";
  context.lineWidth = 12;
  context.strokeStyle = "rgba(250, 248, 235, 0.97)";
  context.strokeText(label, canvas.width / 2, canvas.height / 2);
  context.fillStyle = "#344432";
  context.fillText(label, canvas.width / 2, canvas.height / 2);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  }));
  sprite.name = label;
  sprite.scale.set(230, 33.5, 1);
  sprite.renderOrder = 22;
  return sprite;
}

export function createSanDiegoDistrictMarker(label: string) {
  const marker = createManhattanDestinationMarker("san-diego", 0.45);
  marker.name = `${label} district destination`;
  const text = createSanDiegoLabel(label);
  text.userData.sanDiegoDistrictLabel = true;
  text.position.y = -12;
  marker.add(text);
  return marker;
}

/** Keep billboard text inside the viewport without moving its geographic pin. */
function clampLabel(sprite: THREE.Sprite, camera: THREE.OrthographicCamera, width: number, height: number) {
  sprite.updateWorldMatrix(true, false);
  const position = sprite.getWorldPosition(new THREE.Vector3()).project(camera);
  const scale = sprite.getWorldScale(new THREE.Vector3());
  const pixelWidth = scale.x * camera.zoom * width / (camera.right - camera.left);
  const pixelHeight = scale.y * camera.zoom * height / (camera.top - camera.bottom);
  const x = (position.x + 1) * width / 2;
  const y = (1 - position.y) * height / 2;
  const clampedX = THREE.MathUtils.clamp(x, 8 + sprite.center.x * pixelWidth, width - 8 - (1 - sprite.center.x) * pixelWidth);
  const clampedY = THREE.MathUtils.clamp(y, 8 + (1 - sprite.center.y) * pixelHeight, height - 8 - sprite.center.y * pixelHeight);
  if (x === clampedX && y === clampedY) return;
  position.set(clampedX * 2 / width - 1, 1 - clampedY * 2 / height, position.z).unproject(camera);
  sprite.position.copy(sprite.parent ? sprite.parent.worldToLocal(position) : position);
}

export function constrainSanDiegoLabels(
  camera: THREE.OrthographicCamera,
  width: number,
  height: number,
  markers: Map<THREE.Object3D, SanDiegoDistrictView>,
  annotations: { root: THREE.Sprite; view: SanDiegoDistrictView; anchor: THREE.Vector3 }[],
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
    if (!marker.visible) return;
    marker.updateWorldMatrix(true, true);
    for (const child of marker.children) {
      if (!(child instanceof THREE.Sprite) || !child.userData.sanDiegoDistrictLabel) continue;
      child.position.set(0, -12, 0);
      clampLabel(child, camera, width, height);
    }
  });
  annotations.forEach(({ root, view: annotationView, anchor }) => {
    root.position.copy(anchor);
    root.scale.set(230 * scale, 33.5 * scale, 1);
    root.visible = view === annotationView && onScreen(anchor);
    if (root.visible) clampLabel(root, camera, width, height);
  });
  landmarkMarkers.forEach((marker) => {
    if (marker.visible && !onScreen(marker.position)) marker.visible = false;
  });
}
