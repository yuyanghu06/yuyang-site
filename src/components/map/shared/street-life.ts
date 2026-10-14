import * as THREE from "three";
import { WORLD_UP, type AmbientAnimation } from "./core";

export interface PedestrianSpawn {
  x: number; z: number; heading: number; speed: number; radius: number; phase: number; groundY?: number;
}
export interface CarSpawn {
  start: readonly [number, number]; end: readonly [number, number]; offset: number; speed: number; groundY?: number;
}

export function populationScale(now: number, revealAt: number, index: number, count: number) {
  const stagger = count > 1 ? ((index * 137) % count) / (count - 1) : 0;
  const progress = THREE.MathUtils.clamp((now - revealAt - stagger * 1500) / 420, 0, 1);
  return 1 - Math.pow(1 - progress, 3);
}

export function createPedestrianInstances(scene: THREE.Object3D, walkers: readonly PedestrianSpawn[], isVisible: () => boolean, revealAt: () => number): AmbientAnimation {

  const bodyGeometry = new THREE.BoxGeometry(1.25, 2.45, 0.85);
  const bodyMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1 });
  const bodies = new THREE.InstancedMesh(bodyGeometry, bodyMaterial, walkers.length);
  const headGeometry = new THREE.SphereGeometry(0.58, 5, 4);
  const headMaterial = new THREE.MeshStandardMaterial({ color: 0xc99b78, roughness: 1 });
  const heads = new THREE.InstancedMesh(headGeometry, headMaterial, walkers.length);
  const clothing = [0x596b72, 0x8c665a, 0x746b7c, 0x68745d, 0xb08b5d, 0x4f5352];
  walkers.forEach((_, index) => bodies.setColorAt(index, new THREE.Color(clothing[index % clothing.length])));
  bodies.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  heads.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  bodies.castShadow = false;
  // Orbits/reveal change instance positions and scales after the first frame.
  // A fixed envelope prevents a zero-scale first frame from freezing culling bounds.
  const pedestrianBounds = new THREE.Box3();
  walkers.forEach(walker => {
    const reach = walker.radius + 1;
    pedestrianBounds.expandByPoint(new THREE.Vector3(walker.x - reach, -4, walker.z - reach));
    pedestrianBounds.expandByPoint(new THREE.Vector3(walker.x + reach, 6, walker.z + reach));
  });
  bodies.boundingSphere = pedestrianBounds.getBoundingSphere(new THREE.Sphere());
  heads.boundingSphere = bodies.boundingSphere.clone();
  heads.castShadow = false;
  bodies.name = `${walkers.length} low-detail walking pedestrians across both square views`;
  heads.name = "Pedestrian heads";
  bodies.visible = false;
  heads.visible = false;
  scene.add(bodies, heads);

  const bodyMatrix = new THREE.Matrix4();
  const headMatrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  const scale = new THREE.Vector3(1, 1, 1);
  return {
    update: (elapsed, now) => {
      bodies.visible = isVisible();
      heads.visible = bodies.visible;
      if (!bodies.visible) return;
      walkers.forEach((walker, index) => {
        const arrival = populationScale(now, revealAt(), index, walkers.length);
        const angle = walker.heading + elapsed * walker.speed;
        const x = walker.x + Math.cos(angle) * walker.radius;
        const z = walker.z + Math.sin(angle) * walker.radius;
        const groundOffset = walker.groundY === undefined ? 0 : walker.groundY - 0.925;
        const bob = Math.abs(Math.sin(elapsed * 5 + walker.phase)) * 0.16;
        quaternion.setFromAxisAngle(WORLD_UP, -angle + Math.PI / 2);
        scale.setScalar(arrival);
        bodyMatrix.compose(position.set(x, 2.15 + groundOffset + bob - (1 - arrival) * 3, z), quaternion, scale);
        headMatrix.compose(position.set(x, 4.02 + groundOffset + bob - (1 - arrival) * 3, z), quaternion, scale);
        bodies.setMatrixAt(index, bodyMatrix);
        heads.setMatrixAt(index, headMatrix);
      });
      bodies.instanceMatrix.needsUpdate = true;
      heads.instanceMatrix.needsUpdate = true;
    },
  };
}

export function createCarInstances(
  scene: THREE.Object3D,
  cars: readonly CarSpawn[],
  revealAt: () => number,
  isVisible: () => boolean,
  palette: readonly number[],
  label: string,
): AmbientAnimation {
  // The camera only exposes a portion of the road-data crop and tall buildings
  // occlude many vehicles. A larger simulated fleet keeps roughly 100 cars
  // readable in the overview instead of merely creating 100 mostly hidden ones.
  const count = cars.length;

  const chassis = new THREE.InstancedMesh(
    new THREE.BoxGeometry(6.4, 1.55, 2.9),
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85 }),
    count,
  );
  const cabins = new THREE.InstancedMesh(
    new THREE.BoxGeometry(3.5, 1.25, 2.45),
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8 }),
    count,
  );
  cars.forEach((_, index) => {
    const color = new THREE.Color(palette[index % palette.length]);
    chassis.setColorAt(index, color);
    cabins.setColorAt(index, color.clone().offsetHSL(0, -0.08, 0.08));
  });
  chassis.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  cabins.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  chassis.castShadow = false;
  const trafficBounds = new THREE.Box3();
  cars.forEach(car => [car.start, car.end].forEach(point => {
    trafficBounds.expandByPoint(new THREE.Vector3(point[0] - 4, -3, point[1] - 4));
    trafficBounds.expandByPoint(new THREE.Vector3(point[0] + 4, 5, point[1] + 4));
  }));
  chassis.boundingSphere = trafficBounds.getBoundingSphere(new THREE.Sphere());
  cabins.boundingSphere = chassis.boundingSphere.clone();
  cabins.castShadow = false;
  chassis.name = `${count} ${label}`;
  cabins.name = "Low-detail car cabins";
  chassis.visible = false;
  cabins.visible = false;
  scene.add(chassis, cabins);

  const chassisMatrix = new THREE.Matrix4();
  const cabinMatrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  const scale = new THREE.Vector3(1, 1, 1);
  return {
    update: (elapsed, now) => {
      chassis.visible = isVisible();
      cabins.visible = chassis.visible;
      if (!chassis.visible) return;
      cars.forEach((car, index) => {
        const arrival = populationScale(now, revealAt(), index, count);
        // Ping-pong along each validated vector instead of teleporting from its
        // end back to its start. The direction changes only at an endpoint.
        const groundOffset = car.groundY === undefined ? 0 : car.groundY - 0.775;
        const cycle = (car.offset + elapsed * car.speed) % 2;
        const returning = cycle > 1;
        const progress = returning ? 2 - cycle : cycle;
        const x = THREE.MathUtils.lerp(car.start[0], car.end[0], progress);
        const z = THREE.MathUtils.lerp(car.start[1], car.end[1], progress);
        const direction = returning ? -1 : 1;
        const heading = Math.atan2(
          -(car.end[1] - car.start[1]) * direction,
          (car.end[0] - car.start[0]) * direction,
        );
        quaternion.setFromAxisAngle(WORLD_UP, heading);
        scale.setScalar(arrival);
        chassisMatrix.compose(position.set(x, 1.55 + groundOffset - (1 - arrival) * 2.5, z), quaternion, scale);
        cabinMatrix.compose(position.set(x, 2.62 + groundOffset - (1 - arrival) * 2.5, z), quaternion, scale);
        chassis.setMatrixAt(index, chassisMatrix);
        cabins.setMatrixAt(index, cabinMatrix);
      });
      chassis.instanceMatrix.needsUpdate = true;
      cabins.instanceMatrix.needsUpdate = true;
    },
  };
}
