import * as THREE from "three";

export function disposeSceneObjects(roots: THREE.Object3D[]) {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  const disposeObject = (object: THREE.Object3D) => {
    if (!(object instanceof THREE.Mesh || object instanceof THREE.Line || object instanceof THREE.Points || object instanceof THREE.Sprite)) return;
    // InstancedMesh owns GPU instance buffers beyond its geometry/material.
    if (object instanceof THREE.InstancedMesh) object.dispose();
    if (!(object instanceof THREE.Sprite) && !geometries.has(object.geometry)) {
      geometries.add(object.geometry);
      object.geometry.dispose();
    }
    const objectMaterials = Array.isArray(object.material) ? object.material : [object.material];
    objectMaterials.forEach((material) => {
      if (materials.has(material)) return;
      materials.add(material);
      for (const value of Object.values(material)) {
        if (!(value instanceof THREE.Texture) || textures.has(value)) continue;
        textures.add(value);
        value.dispose();
      }
      material.dispose();
    });
  };
  roots.forEach((root) => root.traverse(disposeObject));
}

export function disposeScenes(renderer: THREE.WebGLRenderer, scenes: THREE.Scene[]) {
  disposeSceneObjects(scenes);
  renderer.dispose();
  renderer.domElement.remove();
}
