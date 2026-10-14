import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import type { GeographicMapView } from "@/agent/context/camera-views";
import { isSanDiegoView } from "@/agent/context/camera-views";
import type { SanDiegoDistrict } from "./load-scene";
import { createCartoonBird, createLowPolyCloud, createPassengerPlane } from "../manhattan/ambient/sky";

/** Batch static lobes/aircraft parts while keeping the shared NYC visual models. */
function batchModel(root: THREE.Group) {
  root.updateMatrixWorld(true);
  const byMaterial = new Map<THREE.Material, THREE.BufferGeometry[]>();
  const originals = new Set<THREE.BufferGeometry>();
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh) || Array.isArray(object.material)) return;
    const geometry = object.geometry.index ? object.geometry.toNonIndexed() : object.geometry.clone();
    geometry.applyMatrix4(object.matrixWorld);
    if (!geometry.attributes.uv) geometry.setAttribute("uv", new THREE.Float32BufferAttribute(new Float32Array(geometry.attributes.position.count * 2), 2));
    const entries = byMaterial.get(object.material) ?? [];
    entries.push(geometry);
    byMaterial.set(object.material, entries);
    originals.add(object.geometry);
  });
  root.clear();
  byMaterial.forEach((entries, material) => {
    const geometry = mergeGeometries(entries);
    entries.forEach((entry) => entry.dispose());
    if (!geometry) throw new Error("Could not batch San Diego sky geometry.");
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    const mesh = new THREE.Mesh(geometry, material);
    mesh.matrixAutoUpdate = false;
    mesh.raycast = () => undefined;
    root.add(mesh);
  });
  originals.forEach((geometry) => geometry.dispose());
  return root;
}

/** Map-anchored overview aircraft/clouds and separate fixed district bird routes. */
export function createSanDiegoSky(scene: THREE.Scene, districts: SanDiegoDistrict[], reducedMotion = false) {
  const root = new THREE.Group();
  root.name = "San Diego clouds, planes and birds";
  root.visible = false;
  root.matrixAutoUpdate = false;
  scene.add(root);
  const cloudMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.18,
    roughness: 1, flatShading: true, depthTest: false, depthWrite: false,
  });
  const travelers: { model: THREE.Group; view: GeographicMapView; speed: number;
    startX: number; endX: number; baseY: number; phase: number; flap?: (elapsed: number, phase: number) => void }[] = [];
  const clouds = [
    [-11200, 620, -3400], [-7400, 780, 7600], [-1700, 690, -2300], [2600, 850, 6800], [6200, 720, 1700],
  ];
  clouds.forEach(([x, y, z], index) => {
    const model = batchModel(createLowPolyCloud(index, [
      [-40, 0, 0, 27], [-15, 13, 4, 35], [20, 7, -3, 32], [49, -3, 2, 23],
    ], cloudMaterial));
    model.name = "San Diego overview low-poly cloud";
    model.position.set(x, y, z);
    model.scale.setScalar(6 + index * 0.2);
    root.add(model);
    travelers.push({ model, view: "san-diego", speed: -18 - index,
      startX: -13500, endX: 7800, baseY: y, phase: index * 0.72 });
  });
  [[-5200, 500, 1900, 100], [4000, 700, -1700, -115]].forEach(([x, y, z, speed], index) => {
    const model = batchModel(createPassengerPlane());
    model.name = "San Diego overview passenger plane";
    model.position.set(x, y, z);
    model.rotation.y = speed < 0 ? Math.PI : 0;
    model.scale.setScalar(5);
    root.add(model);
    travelers.push({ model, view: "san-diego", speed,
      startX: -13500, endX: 7800, baseY: y, phase: index * 2.1 });
  });
  districts.forEach((district) => {
    const [x, y, z] = district.camera.target;
    for (let index = 0; index < 8; index++) {
      const { bird: model, flap } = createCartoonBird(0.62 + (index % 4) * 0.08,
        index % 3 ? 0xfffdf8 : 0xbfc0bd, index % 3 === 0);
      const altitude = y + 170 + (index % 4) * 35;
      model.name = `${district.label} cartoon bird`;
      model.position.set(x - 820 + index * 220, altitude, z - 350 + ((index * 7) % 11) * 70);
      root.add(model);
      travelers.push({ model, view: district.id, speed: 27 + (index % 4) * 3,
        startX: x - 1000, endX: x + 1000, baseY: altitude, phase: index * 0.72, flap });
    }
  });
  root.traverse((object) => { object.updateMatrix(); object.matrixAutoUpdate = false; });
  return {
    root,
    setView: (view: GeographicMapView) => {
      root.visible = isSanDiegoView(view);
      travelers.forEach(({ model, view: owner }) => { model.visible = view === owner; });
    },
    update: (delta: number, elapsed: number) => {
      if (!root.visible) return;
      const time = reducedMotion ? 0 : elapsed;
      for (const traveler of travelers) {
        if (!traveler.model.visible) continue;
        const span = traveler.endX - traveler.startX;
        if (!reducedMotion) traveler.model.position.x = traveler.startX
          + ((traveler.model.position.x - traveler.startX + traveler.speed * delta + span) % span);
        traveler.model.position.y = traveler.baseY + Math.sin(time * 0.55 + traveler.phase) * 3.5;
        traveler.flap?.(time, traveler.phase);
        // Hidden flocks keep frozen transforms; visible wings update after flapping.
        traveler.model.traverse((object) => object.updateMatrix());
      }
    },
  };
}
