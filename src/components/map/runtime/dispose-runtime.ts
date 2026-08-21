import * as THREE from "three";

export function disposeScenes(renderer: THREE.WebGLRenderer, scenes: THREE.Scene[]) {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const disposeObject = (object: THREE.Object3D) => {
    if (!(object instanceof THREE.Mesh || object instanceof THREE.LineSegments)) return;
    if (!geometries.has(object.geometry)) {
      geometries.add(object.geometry);
      object.geometry.dispose();
    }
    const objectMaterials = Array.isArray(object.material) ? object.material : [object.material];
    objectMaterials.forEach((material) => {
      if (materials.has(material)) return;
      materials.add(material);
      material.dispose();
    });
  };
  scenes.forEach((scene) => scene.traverse(disposeObject));
  renderer.dispose();
  renderer.domElement.remove();
}
