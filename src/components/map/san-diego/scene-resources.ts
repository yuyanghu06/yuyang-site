import * as THREE from "three";

/** Cache culling bounds and local transforms; landmark lift remains dynamic. */
export function prepareSanDiegoScene(group: THREE.Group, landmarkRoots: THREE.Mesh[]) {
  const dynamicRoots = new Set<THREE.Object3D>(landmarkRoots);
  group.traverse((object) => {
    object.updateMatrix();
    object.matrixAutoUpdate = dynamicRoots.has(object);
    if (!(object instanceof THREE.Mesh)) return;
    object.geometry.computeBoundingBox();
    object.geometry.computeBoundingSphere();
    const category = object.userData.backgroundCategory ?? object.name;
    object.castShadow = category !== "terrain";
    object.receiveShadow = true;
  });
}

/** Merged roots already own exact local geometry; no transformed clone needed. */
export function createSanDiegoLandmarkGlow(root: THREE.Mesh) {
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
  const surface = new THREE.Mesh(root.geometry, material);
  surface.renderOrder = 4;
  surface.raycast = () => undefined;
  surface.matrixAutoUpdate = false;
  const glow = new THREE.Group();
  glow.name = "Clickable landmark surface glow";
  glow.matrixAutoUpdate = false;
  glow.add(surface);
  return glow;
}
