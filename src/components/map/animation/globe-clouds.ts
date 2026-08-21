import * as THREE from "three";

export function animateGlobeClouds(
  clouds: THREE.Group,
  delta: number,
  localDown: THREE.Vector3,
  inward: THREE.Vector3,
) {
  for (const cloud of clouds.children) {
    cloud.position.applyAxisAngle(
      cloud.userData.orbitAxis as THREE.Vector3,
      (cloud.userData.orbitSpeed as number) * delta,
    );
    inward.copy(cloud.position).normalize().negate();
    cloud.quaternion.setFromUnitVectors(localDown, inward);
    cloud.rotateY(cloud.userData.twist as number);
  }
}
