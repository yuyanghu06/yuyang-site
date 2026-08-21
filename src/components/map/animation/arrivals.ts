import * as THREE from "three";

export interface SpringArrival {
  root: THREE.Object3D;
  materials: THREE.Material[];
  startedAt: number;
  distance: number;
  rise: number;
  fade: boolean;
  targetY?: number;
  durationMs?: number;
  freezeRoot?: boolean;
}

export function animateArrivals(
  arrivals: SpringArrival[],
  now: number,
  renderer: THREE.WebGLRenderer,
) {
  for (let index = arrivals.length - 1; index >= 0; index -= 1) {
    const arrival = arrivals[index];
    if (now < arrival.startedAt) {
      arrival.root.visible = false;
      continue;
    }
    arrival.root.visible = true;
    const duration = arrival.durationMs ?? (arrival.rise === 0 ? 220 : 1120);
    const progress = THREE.MathUtils.clamp((now - arrival.startedAt) / duration, 0, 1);
    const spring = 1 - Math.exp(-4.8 * progress) * Math.cos(12.5 * progress);
    const targetY = arrival.targetY ?? 0;
    arrival.root.position.y = targetY - arrival.rise * (1 - spring);
    if (arrival.fade) {
      const opacity = THREE.MathUtils.smoothstep(progress, 0, 1);
      for (const material of arrival.materials) material.opacity = opacity;
    }
    if (progress < 1) continue;
    arrival.root.position.y = targetY;
    if (arrival.freezeRoot) {
      arrival.root.updateMatrix();
      arrival.root.matrixAutoUpdate = false;
    }
    for (const material of arrival.materials) {
      material.opacity = 1;
      if (!arrival.fade) material.transparent = false;
      material.depthWrite = true;
      material.needsUpdate = true;
    }
    arrivals.splice(index, 1);
    renderer.shadowMap.needsUpdate = true;
  }
}
