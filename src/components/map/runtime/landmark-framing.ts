import * as THREE from "three";

interface BoundsFraming {
  bounds: THREE.Box3;
  camera: THREE.OrthographicCamera;
  target: THREE.Vector3;
  azimuth: number;
  height: number;
  radius: number;
  maximumZoom: number;
}

/** Fit the merged landmark at its destination angle, keeping a 7% edge inset. */
export function getLandmarkFitZoom({ root, camera, target, azimuth, height, radius, maximumZoom }: LandmarkFraming) {
  root.updateWorldMatrix(true, true);
  const bounds = new THREE.Box3().setFromObject(root);
  return getBoundsFitZoom({ bounds, camera, target, azimuth, height, radius, maximumZoom });
}

type LandmarkFraming = Omit<BoundsFraming, "bounds"> & { root: THREE.Object3D };

/** Fit geographic coverage without making the landscape an interactive landmark. */
export function getBoundsFitZoom({ bounds, camera, target, azimuth, height, radius, maximumZoom }: BoundsFraming) {
  if (bounds.isEmpty()) return maximumZoom;
  const framingCamera = camera.clone();
  framingCamera.zoom = 1;
  framingCamera.position.set(
    target.x + Math.sin(azimuth) * radius,
    height,
    target.z + Math.cos(azimuth) * radius,
  );
  framingCamera.lookAt(target);
  framingCamera.updateProjectionMatrix();
  framingCamera.updateMatrixWorld(true);
  const corner = new THREE.Vector3();
  let projectedExtent = 0;
  for (const x of [bounds.min.x, bounds.max.x]) {
    for (const y of [bounds.min.y, bounds.max.y]) {
      for (const z of [bounds.min.z, bounds.max.z]) {
        corner.set(x, y, z).project(framingCamera);
        projectedExtent = Math.max(projectedExtent, Math.abs(corner.x), Math.abs(corner.y));
      }
    }
  }
  return projectedExtent > 0 ? Math.min(maximumZoom, 0.86 / projectedExtent) : maximumZoom;
}
