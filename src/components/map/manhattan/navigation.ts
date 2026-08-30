import * as THREE from "three";
import {
  NAVIGATION_ARROW_SCALE,
  NAVIGATION_ARROW_Y,
  WASHINGTON_ARROW_POSITION,
} from "../shared/core";
import type { LandmarkCameraViewId } from "@/agent/context/camera-views";

export function createManhattanDestinationMarker(
  destination: "washington" | "union",
  displayScale = 1,
) {
  const group = new THREE.Group();
  group.name = `${destination === "washington" ? "Washington" : "Union"} Square Manhattan destination marker`;
  const fallbackCanvas = document.createElement("canvas");
  fallbackCanvas.width = 256;
  fallbackCanvas.height = 320;
  const context = fallbackCanvas.getContext("2d");
  if (!context) throw new Error("Could not create the SVG marker fallback canvas");
  context.shadowColor = "rgba(242, 201, 76, 0.92)";
  context.shadowBlur = 30;
  context.fillStyle = "#f2c94c";
  context.fillRect(104, 47, 48, 170);
  context.strokeStyle = "#17140f";
  context.lineWidth = 8;
  context.strokeRect(104, 47, 48, 170);
  context.beginPath();
  context.arc(128, 263, 24, 0, Math.PI * 2);
  context.fill();
  context.stroke();
  const fallbackTexture = new THREE.CanvasTexture(fallbackCanvas);
  fallbackTexture.colorSpace = THREE.SRGBColorSpace;
  const pinMaterial = new THREE.SpriteMaterial({
    map: fallbackTexture,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  });
  const pin = new THREE.Sprite(pinMaterial);
  pin.name = `${group.name} placeholder point-of-interest pin`;
  pin.position.y = 85 * displayScale;
  pin.scale.set(108 * displayScale, 135 * displayScale, 1);
  pin.renderOrder = 21;
  group.add(pin);
  group.userData.baseY = 8;
  return group;
}

export interface ClickableLandmark {
  root: THREE.Object3D;
  glow: THREE.Object3D;
  cameraViewId: LandmarkCameraViewId;
  baseY: number;
  hovered: boolean;
  selected: boolean;
}

export function createBuildingGlow(source: THREE.Object3D) {
  source.updateMatrixWorld(true);
  const inverseRoot = source.matrixWorld.clone().invert();
  const glow = new THREE.Group();
  const material = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.16,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  source.traverse((object) => {
    if (!(object instanceof THREE.Mesh) || object instanceof THREE.InstancedMesh) return;
    const geometry = object.geometry.clone();
    geometry.applyMatrix4(inverseRoot.clone().multiply(object.matrixWorld));
    const surface = new THREE.Mesh(geometry, material);
    surface.renderOrder = 4;
    surface.raycast = () => undefined;
    glow.add(surface);
  });
  glow.name = "Clickable landmark surface glow";
  return glow;
}

export function createWorldNavigationArrow() {
  const shape = new THREE.Shape();
  shape.moveTo(-4, -14);
  shape.lineTo(4, -14);
  shape.lineTo(4, 4);
  shape.lineTo(10, 4);
  shape.lineTo(0, 16);
  shape.lineTo(-10, 4);
  shape.lineTo(-4, 4);
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: 4,
    bevelEnabled: true,
    bevelSize: 0.65,
    bevelThickness: 0.65,
    bevelSegments: 2,
  });
  geometry.rotateX(-Math.PI / 2);
  const material = new THREE.MeshStandardMaterial({
    color: 0xe2dfd6,
    emissive: 0xffffff,
    emissiveIntensity: 0.035,
    roughness: 0.68,
    metalness: 0,
    side: THREE.DoubleSide,
  });
  const arrow = new THREE.Mesh(geometry, material);
  arrow.castShadow = true;
  arrow.receiveShadow = true;
  arrow.renderOrder = 8;
  const shine = new THREE.Mesh(
    geometry,
    new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.07,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      toneMapped: false,
    }),
  );
  shine.scale.setScalar(1.045);
  shine.renderOrder = 7;
  shine.raycast = () => undefined;
  shine.name = "Navigation arrow white shine";
  const group = new THREE.Group();
  group.add(shine, arrow);
  group.position.set(WASHINGTON_ARROW_POSITION.x, NAVIGATION_ARROW_Y, WASHINGTON_ARROW_POSITION.y);
  group.rotation.y = -0.754;
  group.scale.setScalar(NAVIGATION_ARROW_SCALE);
  group.name = "World-space square navigation arrow";
  return group;
}
