import * as THREE from "three";

// Temporary authoring aid: turn this off to restore San Diego's guided inputs.
export const SAN_DIEGO_FREE_CAMERA_ENABLED = false;

export interface FreeCameraPose {
  target: THREE.Vector3;
  azimuth: number;
  height: number;
  radius: number;
  zoom: number;
}

export type FreeCameraGesture =
  | { kind: "orbit"; deltaX: number; deltaY: number }
  | { kind: "pan"; deltaX: number; deltaY: number }
  | { kind: "zoom"; delta: number };

/** Adjust the displayed orthographic pose; the runtime synchronizes its desired pose. */
export function adjustFreeCamera(
  pose: FreeCameraPose,
  gesture: FreeCameraGesture,
  camera: THREE.OrthographicCamera,
  viewport: { width: number; height: number },
): FreeCameraPose {
  const next = { ...pose, target: pose.target.clone() };
  const elevation = Math.atan2(pose.height - pose.target.y, pose.radius);
  if (gesture.kind === "orbit") {
    const distance = Math.max(100, Math.hypot(pose.radius, pose.height - pose.target.y));
    const tilt = THREE.MathUtils.clamp(elevation + gesture.deltaY * 0.004, Math.PI / 12, Math.PI * 0.47);
    next.azimuth -= gesture.deltaX * 0.005;
    next.radius = distance * Math.cos(tilt);
    next.height = Math.max(40, pose.target.y + distance * Math.sin(tilt));
  } else if (gesture.kind === "pan") {
    const horizontal = -(camera.right - camera.left) * gesture.deltaX / (Math.max(1, viewport.width) * pose.zoom);
    const vertical = -(camera.top - camera.bottom) * gesture.deltaY
      / (Math.max(1, viewport.height) * pose.zoom * Math.max(0.25, Math.sin(elevation)));
    next.target.x += Math.cos(pose.azimuth) * horizontal + Math.sin(pose.azimuth) * vertical;
    next.target.z += -Math.sin(pose.azimuth) * horizontal + Math.cos(pose.azimuth) * vertical;
  } else {
    next.zoom = THREE.MathUtils.clamp(pose.zoom * Math.exp(-gesture.delta * 0.002), 0.16, 12);
  }
  return next;
}

export function serializeFreeCamera(view: string, pose: FreeCameraPose): string {
  const rounded = (value: number) => Number(value.toFixed(6));
  return JSON.stringify({
    view,
    target: pose.target.toArray().map(rounded),
    azimuth: rounded(pose.azimuth),
    height: rounded(pose.height),
    radius: rounded(pose.radius),
    zoom: rounded(pose.zoom),
  }, null, 2);
}
