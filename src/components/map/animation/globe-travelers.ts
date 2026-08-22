import * as THREE from "three";
import { GLOBE_RADIUS, globePoint } from "../globe/scene";
import { createPassengerBoat, createPassengerPlane } from "../manhattan/ambient/sky";

const IMPORTED_LONGITUDE_OFFSET = 224;
// The imported GLB is normalized by its outer land bounds. Its inset water
// mesh therefore renders at roughly radius 345 rather than GLOBE_RADIUS 360.
const GLOBE_WATER_RADIUS = 345;
const BOAT_HULL_RADIUS = 7;
const outward = new THREE.Vector3();
const tangent = new THREE.Vector3();
const frameZ = new THREE.Vector3();
const nextPosition = new THREE.Vector3();
const frame = new THREE.Matrix4();

function orientTraveler(traveler: THREE.Object3D, direction: THREE.Vector3) {
  outward.copy(traveler.position).normalize();
  tangent.copy(direction).addScaledVector(outward, -direction.dot(outward)).normalize();
  frameZ.crossVectors(tangent, outward).normalize();
  traveler.quaternion.setFromRotationMatrix(frame.makeBasis(tangent, outward, frameZ));
}

function createSatellite() {
  const satellite = new THREE.Group();
  const bodyMaterial = new THREE.MeshStandardMaterial({ color: 0xd9d6ca, roughness: 0.72, metalness: 0.18 });
  const darkMaterial = new THREE.MeshStandardMaterial({ color: 0x35464c, roughness: 0.8 });
  const panelMaterial = new THREE.MeshStandardMaterial({ color: 0x416d82, roughness: 0.65, metalness: 0.1 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(12, 10, 10), bodyMaterial);
  satellite.add(body);
  for (const side of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(10, 1.2, 1.2), darkMaterial);
    arm.position.x = side * 10;
    satellite.add(arm);
    const panel = new THREE.Mesh(new THREE.BoxGeometry(18, 1, 11), panelMaterial);
    panel.position.x = side * 23;
    satellite.add(panel);
  }
  const dish = new THREE.Mesh(
    new THREE.CylinderGeometry(1.8, 5.4, 4, 12, 1, true),
    bodyMaterial,
  );
  dish.rotation.z = Math.PI / 2;
  dish.position.x = 8;
  satellite.add(dish);
  satellite.name = "Low-poly globe satellite";
  return satellite;
}

export function createGlobeTravelers() {
  const travelers = new THREE.Group();
  const planeTemplate = createPassengerPlane();
  const boatTemplate = createPassengerBoat();
  const satelliteTemplate = createSatellite();
  const planeSettings = [
    { latitude: 22, longitude: -48, axis: [0.18, 0.94, 0.29], speed: 0.043, scale: 0.56 },
    { latitude: 48, longitude: 42, axis: [-0.34, 0.88, -0.31], speed: -0.052, scale: 0.48 },
    { latitude: 7, longitude: 118, axis: [0.71, 0.45, -0.54], speed: 0.047, scale: 0.5 },
    { latitude: -28, longitude: 151, axis: [-0.63, 0.69, 0.35], speed: -0.045, scale: 0.54 },
    { latitude: -43, longitude: -72, axis: [0.42, 0.79, 0.45], speed: 0.05, scale: 0.46 },
    { latitude: 18, longitude: -154, axis: [-0.57, 0.58, -0.58], speed: -0.048, scale: 0.52 },
  ] as const;

  planeSettings.forEach((setting) => {
    const carrier = new THREE.Group();
    const plane = planeTemplate.clone(true);
    plane.scale.setScalar(setting.scale);
    carrier.add(plane);
    carrier.position.copy(globePoint(
      setting.latitude,
      setting.longitude + IMPORTED_LONGITUDE_OFFSET,
      GLOBE_RADIUS + 48,
    ));
    const orbitAxis = new THREE.Vector3(...setting.axis).normalize();
    carrier.userData.kind = "plane";
    carrier.userData.orbitAxis = orbitAxis;
    carrier.userData.orbitSpeed = setting.speed;
    tangent.crossVectors(orbitAxis, carrier.position).multiplyScalar(Math.sign(setting.speed));
    orientTraveler(carrier, tangent);
    carrier.name = "Globe-orbiting passenger airplane";
    travelers.add(carrier);
  });

  const satelliteSettings = [
    { latitude: 58, longitude: -116, axis: [0.14, 0.98, -0.12], speed: 0.022, radius: 560, scale: 0.82 },
    { latitude: 12, longitude: -12, axis: [0.76, 0.22, 0.61], speed: -0.026, radius: 590, scale: 0.72 },
    { latitude: -36, longitude: 78, axis: [-0.5, 0.81, 0.3], speed: 0.024, radius: 575, scale: 0.78 },
    { latitude: 28, longitude: 164, axis: [0.43, 0.54, -0.72], speed: -0.021, radius: 610, scale: 0.68 },
  ] as const;

  satelliteSettings.forEach((setting) => {
    const carrier = new THREE.Group();
    const satellite = satelliteTemplate.clone(true);
    satellite.scale.setScalar(setting.scale);
    carrier.add(satellite);
    carrier.position.copy(globePoint(
      setting.latitude,
      setting.longitude + IMPORTED_LONGITUDE_OFFSET,
      setting.radius,
    ));
    const orbitAxis = new THREE.Vector3(...setting.axis).normalize();
    carrier.userData.kind = "satellite";
    carrier.userData.orbitAxis = orbitAxis;
    carrier.userData.orbitSpeed = setting.speed;
    tangent.crossVectors(orbitAxis, carrier.position).multiplyScalar(Math.sign(setting.speed));
    orientTraveler(carrier, tangent);
    carrier.name = "High-orbit globe satellite";
    travelers.add(carrier);
  });

  const boatSettings = [
    { start: [36, -69], end: [40, -48], speed: 0.0275, phase: 0.08, scale: 0.32 },
    { start: [20, -72], end: [25, -52], speed: 0.023, phase: 0.42, scale: 0.28 },
    { start: [-8, -31], end: [2, -14], speed: 0.025, phase: 0.71, scale: 0.26 },
    { start: [34, 146], end: [39, 169], speed: 0.024, phase: 0.19, scale: 0.28 },
    { start: [-22, -138], end: [-15, -116], speed: 0.026, phase: 0.55, scale: 0.27 },
    { start: [-31, 73], end: [-24, 94], speed: 0.022, phase: 0.83, scale: 0.3 },
    { start: [12, 58], end: [18, 76], speed: 0.0245, phase: 0.31, scale: 0.25 },
    { start: [37, 2], end: [35, 20], speed: 0.0215, phase: 0.65, scale: 0.24 },
    { start: [-39, 5], end: [-35, 25], speed: 0.0235, phase: 0.92, scale: 0.29 },
  ] as const;

  boatSettings.forEach((setting) => {
    const carrier = new THREE.Group();
    const boat = boatTemplate.clone(true);
    boat.rotation.y = -Math.PI / 2;
    boat.scale.setScalar(setting.scale);
    carrier.add(boat);
    const routeRadius = GLOBE_WATER_RADIUS + BOAT_HULL_RADIUS * setting.scale;
    carrier.userData.kind = "boat";
    carrier.userData.routeStart = globePoint(
      setting.start[0],
      setting.start[1] + IMPORTED_LONGITUDE_OFFSET,
      routeRadius,
    );
    carrier.userData.routeEnd = globePoint(
      setting.end[0],
      setting.end[1] + IMPORTED_LONGITUDE_OFFSET,
      routeRadius,
    );
    carrier.userData.routeSpeed = setting.speed;
    carrier.userData.routePhase = setting.phase;
    carrier.userData.routeRadius = routeRadius;
    carrier.name = "Globe ocean passenger boat";
    travelers.add(carrier);
  });

  travelers.name = "Globe planes and ocean boats";
  return travelers;
}

export function animateGlobeTravelers(travelers: THREE.Group, delta: number, elapsed: number) {
  for (const traveler of travelers.children) {
    if (traveler.userData.kind !== "boat") {
      const orbitAxis = traveler.userData.orbitAxis as THREE.Vector3;
      const orbitStep = (traveler.userData.orbitSpeed as number) * delta;
      traveler.position.applyAxisAngle(orbitAxis, orbitStep);
      tangent.crossVectors(orbitAxis, traveler.position).multiplyScalar(Math.sign(orbitStep));
      orientTraveler(traveler, tangent);
      continue;
    }

    const routeStart = traveler.userData.routeStart as THREE.Vector3;
    const routeEnd = traveler.userData.routeEnd as THREE.Vector3;
    const routeRadius = traveler.userData.routeRadius as number;
    const routeTime = elapsed * (traveler.userData.routeSpeed as number)
      + (traveler.userData.routePhase as number);
    const routeProgress = (Math.sin(routeTime * Math.PI * 2) + 1) / 2;
    const nextProgress = (Math.sin((routeTime + 0.001) * Math.PI * 2) + 1) / 2;
    traveler.position.copy(routeStart).lerp(routeEnd, routeProgress).normalize().multiplyScalar(routeRadius);
    nextPosition.copy(routeStart).lerp(routeEnd, nextProgress).normalize().multiplyScalar(routeRadius);
    tangent.copy(nextPosition).sub(traveler.position);
    orientTraveler(traveler, tangent);
  }
}
