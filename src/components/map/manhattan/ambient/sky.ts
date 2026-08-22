import * as THREE from "three";
import type { SkyTraveler } from "../../shared/core";
import { GLOBE_RADIUS } from "../../globe/scene";

export function createCartoonBird(scale: number, color: number, isPigeon: boolean) {
  const bird = new THREE.Group();
  const material = new THREE.MeshStandardMaterial({
    color,
    roughness: 1,
    side: THREE.DoubleSide,
  });
  const body = new THREE.Mesh(new THREE.SphereGeometry(3.2, 8, 6), material);
  body.scale.set(isPigeon ? 1.35 : 1.65, isPigeon ? 0.88 : 0.65, isPigeon ? 0.82 : 0.65);
  bird.add(body);

  if (isPigeon) {
    const head = new THREE.Mesh(new THREE.SphereGeometry(2.25, 8, 6), material);
    head.position.set(4.2, 1.4, 0);
    bird.add(head);
    const beak = new THREE.Mesh(
      new THREE.ConeGeometry(0.75, 2.5, 5),
      new THREE.MeshStandardMaterial({ color: 0xc9a982, roughness: 1 }),
    );
    beak.position.set(6.7, 1.35, 0);
    beak.rotation.z = -Math.PI / 2;
    bird.add(beak);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.7, 4.2), material);
    tail.position.set(-5.4, 0, 0);
    tail.rotation.z = -0.16;
    bird.add(tail);
  }

  const wingGeometry = new THREE.BufferGeometry();
  wingGeometry.setAttribute("position", new THREE.Float32BufferAttribute(isPigeon ? [
    0, 0, 0,
    -4, 0, 11,
    6, 0, 8,
    0, 0, 0,
    6, 0, 8,
    8, 0, 3,
  ] : [
    0, 0, 0,
    -2, 0, 15,
    8, 0, 8,
  ], 3));
  wingGeometry.computeVertexNormals();
  const leftWing = new THREE.Mesh(wingGeometry, material);
  const rightWing = new THREE.Mesh(wingGeometry.clone(), material);
  rightWing.scale.z = -1;
  bird.add(leftWing, rightWing);
  bird.scale.setScalar(scale);
  bird.name = "Looping cartoon bird";

  return {
    bird,
    flap: (elapsed: number, phase: number) => {
      const angle = Math.sin(elapsed * 7.5 + phase) * 0.42;
      leftWing.rotation.x = angle;
      rightWing.rotation.x = -angle;
      bird.rotation.z = Math.sin(elapsed * 1.2 + phase) * 0.035;
    },
  };
}

export function createNeighborhoodBirdTravelers(scene: THREE.Scene) {
  const travelers: SkyTraveler[] = [];
  const birdSettings = [
    { x: -820, y: 250, z: -330, scale: 0.68, speed: 29, phase: 0.2, color: 0xfffdf8 },
    { x: -570, y: 390, z: -215, scale: 0.92, speed: 35, phase: 0.9, color: 0xb8b9b6 },
    { x: -310, y: 305, z: -95, scale: 0.74, speed: 31, phase: 1.7, color: 0xe1e1dd },
    { x: -40, y: 430, z: 35, scale: 0.62, speed: 38, phase: 2.5, color: 0xfffdf8 },
    { x: 190, y: 275, z: 155, scale: 0.84, speed: 27, phase: 3.3, color: 0xc9cac7 },
    { x: 420, y: 360, z: 280, scale: 0.7, speed: 33, phase: 4.1, color: 0xfffdf8 },
    { x: 650, y: 315, z: -270, scale: 0.78, speed: 30, phase: 4.8, color: 0xadaeab },
    { x: 810, y: 405, z: -10, scale: 0.58, speed: 40, phase: 5.6, color: 0xd8d8d4 },
    { x: 75, y: 335, z: 360, scale: 0.66, speed: 36, phase: 6.2, color: 0xfffdf8 },
    { x: -680, y: 205, z: 390, scale: 0.88, speed: 32, phase: 0.6, color: 0xbfc0bd },
    { x: -390, y: 230, z: 315, scale: 0.72, speed: 37, phase: 2.9, color: 0xfffdf8 },
    { x: -740, y: 325, z: 120, scale: 0.64, speed: 34, phase: 1.3, color: 0xd4d5d1 },
    { x: -180, y: 370, z: -285, scale: 0.8, speed: 28, phase: 2.2, color: 0xfffdf8 },
    { x: 310, y: 215, z: 330, scale: 0.76, speed: 39, phase: 3.8, color: 0xb5b6b3 },
    { x: 545, y: 425, z: 70, scale: 0.6, speed: 36, phase: 5.1, color: 0xe3e3df },
    { x: 760, y: 265, z: 220, scale: 0.86, speed: 30, phase: 5.9, color: 0xfffdf8 },
  ];
  for (const setting of birdSettings) {
    const isPigeon = setting.color !== 0xfffdf8;
    const { bird, flap } = createCartoonBird(setting.scale, setting.color, isPigeon);
    bird.position.set(setting.x, setting.y, setting.z);
    scene.add(bird);
    travelers.push({
      group: bird,
      view: "neighborhood",
      speed: setting.speed,
      phase: setting.phase,
      startX: -900,
      endX: 900,
      baseY: setting.y,
      flap: (elapsed) => flap(elapsed, setting.phase),
    });
  }
  return travelers;
}

export function createLowPolyCloud(
  cloudIndex: number,
  lobes: number[][],
  material: THREE.Material,
) {
  const cloud = new THREE.Group();
  for (const [lobeIndex, [x, y, z, radius]] of lobes.entries()) {
    const variant = (cloudIndex + lobeIndex) % 3;
    const geometry = variant === 0
      ? new THREE.IcosahedronGeometry(radius, 2)
      : variant === 1
        ? new THREE.DodecahedronGeometry(radius, 1)
        : new THREE.OctahedronGeometry(radius, 2);
    const lobe = new THREE.Mesh(geometry, material);
    lobe.position.set(x, y, z);
    lobe.scale.set(1, 0.88 + ((cloudIndex + lobeIndex) % 3) * 0.08, 0.58 + (lobeIndex % 2) * 0.1);
    lobe.rotation.set(
      (cloudIndex * 0.17 + lobeIndex * 0.11) % 0.42,
      (cloudIndex * 0.31 + lobeIndex * 0.23) % 0.7,
      (cloudIndex * 0.09 - lobeIndex * 0.13) % 0.36,
    );
    cloud.add(lobe);
  }
  return cloud;
}

export function createGlobeClouds() {
  const cloudLayer = new THREE.Group();
  const material = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0xffffff,
    emissiveIntensity: 0.14,
    roughness: 1,
    flatShading: true,
  });
  const cloudShapes = [
    [[-66, 2, 0, 24], [-38, 13, 5, 34], [0, 25, 0, 48], [40, 10, -5, 36], [72, 0, 3, 22]],
    [[-25, 0, 2, 25], [4, 16, -2, 38], [34, 1, 3, 27]],
    [[-38, 0, 0, 31], [-11, 31, 4, 43], [18, 4, -4, 35], [44, -2, 2, 22]],
    [[-53, 0, 2, 21], [-28, 8, -3, 29], [0, 15, 4, 34], [31, 9, -4, 29], [57, 0, 2, 20]],
    // Compact radial layouts keep several clouds visibly round instead of
    // making every formation a horizontal chain.
    [[0, 23, 0, 46], [-27, 7, 3, 29], [28, 8, -3, 31], [0, 5, 25, 27]],
    [[0, 17, 0, 42], [-24, 4, 17, 27], [24, 5, 16, 28], [-3, 3, -24, 25]],
    [[-72, 0, 2, 20], [-47, 7, -3, 28], [-17, 23, 4, 39], [17, 15, -4, 34], [48, 24, 2, 41], [78, 0, 0, 24]],
  ];
  const localDown = new THREE.Vector3(0, -1, 0);
  const inward = new THREE.Vector3();
  const cloudCount = 7;
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  const randomUnit = (index: number, salt: number) => {
    const value = Math.sin(index * 91.173 + salt * 47.237) * 43758.5453;
    return value - Math.floor(value);
  };
  for (let index = 0; index < cloudCount; index += 1) {
    const cloud = createLowPolyCloud(index, cloudShapes[index % cloudShapes.length], material);
    const bounds = new THREE.Box3().setFromObject(cloud);
    cloud.children.forEach((lobe) => { lobe.position.y -= bounds.min.y; });
    const vertical = 1 - 2 * ((index + 0.5) / cloudCount);
    const horizontalRadius = Math.sqrt(1 - vertical * vertical);
    const longitude = index * goldenAngle + (randomUnit(index, 1) - 0.5) * 0.62;
    const originalDistance = 445 + randomUnit(index, 2) * 85;
    const distance = GLOBE_RADIUS + (originalDistance - GLOBE_RADIUS) * 0.8;
    cloud.position.set(
      Math.cos(longitude) * horizontalRadius * distance,
      vertical * distance,
      Math.sin(longitude) * horizontalRadius * distance,
    );
    cloud.scale.setScalar(0.29 + randomUnit(index, 3) * 0.39);
    inward.copy(cloud.position).normalize().negate();
    cloud.quaternion.setFromUnitVectors(localDown, inward);
    const twist = (randomUnit(index, 4) - 0.5) * Math.PI;
    cloud.rotateY(twist);
    cloud.userData.twist = twist;
    cloud.userData.orbitSpeed = 0.006 + randomUnit(index, 5) * 0.007;
    cloud.userData.orbitAxis = new THREE.Vector3(
      randomUnit(index, 6) - 0.5,
      randomUnit(index, 7) - 0.5,
      randomUnit(index, 8) - 0.5,
    ).normalize();
    cloud.name = "Globe low-poly cloud";
    cloudLayer.add(cloud);
  }
  cloudLayer.name = "Globe cloud layer using Manhattan cloud models";
  return cloudLayer;
}

export function createPassengerPlane(color = 0xffffff) {
  const plane = new THREE.Group();
  const material = new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, toneMapped: false });
  const detailMaterial = new THREE.MeshBasicMaterial({ color: 0x46545a, side: THREE.DoubleSide });
  const fuselage = new THREE.Mesh(new THREE.CapsuleGeometry(5.2, 58, 5, 10), material);
  fuselage.rotation.z = Math.PI / 2;
  plane.add(fuselage);
  const nose = new THREE.Mesh(new THREE.ConeGeometry(5.15, 13, 10), material);
  nose.rotation.z = -Math.PI / 2;
  nose.position.x = 42;
  plane.add(nose);
  const wingGeometry = new THREE.BufferGeometry();
  wingGeometry.setAttribute("position", new THREE.Float32BufferAttribute([
    12, 0, 0, -12, 0, 49, -24, 0, 47,
    12, 0, 0, -24, 0, 47, -7, 0, 0,
    12, 0, 0, -24, 0, -47, -12, 0, -49,
    12, 0, 0, -7, 0, 0, -24, 0, -47,
  ], 3));
  wingGeometry.computeVertexNormals();
  plane.add(new THREE.Mesh(wingGeometry, material));
  const tailWing = new THREE.Mesh(new THREE.BoxGeometry(12, 1.5, 29), material);
  tailWing.position.x = -31;
  plane.add(tailWing);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(12, 19, 2.4), material);
  tail.position.set(-32, 8, 0);
  plane.add(tail);
  for (const z of [-18, 18]) {
    const engine = new THREE.Mesh(new THREE.CylinderGeometry(3.5, 4.1, 12, 8), material);
    engine.rotation.z = Math.PI / 2;
    engine.position.set(-3, -4, z);
    plane.add(engine);
  }
  const cockpit = new THREE.Mesh(new THREE.BoxGeometry(1.2, 3.2, 6.8), detailMaterial);
  cockpit.position.set(35.8, 2.8, 0);
  plane.add(cockpit);
  for (let index = 0; index < 9; index += 1) {
    for (const side of [-1, 1]) {
      const window = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.25, 0.35), detailMaterial);
      window.position.set(24 - index * 5.3, 2.8, side * 5.05);
      plane.add(window);
    }
  }
  plane.name = "Low-poly passenger airplane";
  return plane;
}

export function createPassengerBoat() {
  const boat = new THREE.Group();
  const boatWhite = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.78 });
  const boatHullMaterial = new THREE.MeshStandardMaterial({ color: 0x42565b, roughness: 0.82 });
  const boatWindowMaterial = new THREE.MeshBasicMaterial({ color: 0x34474d });
  const hull = new THREE.Mesh(new THREE.CapsuleGeometry(7, 31, 4, 8), boatHullMaterial);
  hull.rotation.x = Math.PI / 2;
  hull.scale.x = 1.45;
  boat.add(hull);
  const bow = new THREE.Mesh(new THREE.ConeGeometry(9.8, 17, 8), boatHullMaterial);
  bow.rotation.x = -Math.PI / 2;
  bow.position.z = -24;
  boat.add(bow);
  const deck = new THREE.Mesh(new THREE.BoxGeometry(17, 2.2, 32), boatWhite);
  deck.position.y = 5.5;
  boat.add(deck);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(14, 8, 18), boatWhite);
  cabin.position.set(0, 10.5, 4);
  boat.add(cabin);
  for (const x of [-7.15, 7.15]) {
    const windows = new THREE.Mesh(new THREE.BoxGeometry(0.45, 3.4, 12), boatWindowMaterial);
    windows.position.set(x, 11.5, 2);
    boat.add(windows);
  }
  const windshield = new THREE.Mesh(new THREE.BoxGeometry(9, 3.2, 0.45), boatWindowMaterial);
  windshield.position.set(0, 11.5, -5.15);
  boat.add(windshield);
  boat.name = "Small passenger boat";
  return boat;
}

export function createSkyTravelers(scene: THREE.Scene, overlayScene: THREE.Scene) {
  const travelers: SkyTraveler[] = [];
  const cloudMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0xffffff,
    emissiveIntensity: 0.18,
    roughness: 1,
    flatShading: true,
    depthTest: false,
    depthWrite: false,
  });
  const cloudSettings = [
    {
      x: -1680, y: 650, z: -930, scale: 2.28, speed: -10, phase: 0.3,
      lobes: [[-46, -4, 2, 34], [-12, 12, 0, 48], [32, 4, -2, 39], [67, -7, 3, 27]],
    },
    {
      x: -1260, y: 690, z: -980, scale: 2.56, speed: -10.4, phase: 1.6,
      lobes: [[-55, -7, 0, 28], [-28, 4, 5, 37], [5, 18, 0, 52], [43, 1, -3, 35], [70, -9, 4, 24]],
    },
    {
      x: -820, y: 640, z: -900, scale: 2.42, speed: -9.8, phase: 4.1,
      lobes: [[-44, 0, 0, 38], [-6, 20, 3, 45], [29, -1, -2, 42], [61, 7, 1, 30], [-8, -13, 9, 34]],
    },
    {
      x: 520, y: 1280, z: 2410, scale: 2.72, speed: -10.1, phase: 4.7,
      lobes: [[-58, -9, 3, 27], [-31, 4, -2, 35], [3, 17, 2, 47], [39, 3, -4, 38], [67, -8, 3, 25]],
    },
    {
      x: 960, y: 860, z: 1660, scale: 2.34, speed: -9.9, phase: 2.4,
      lobes: [[-47, -8, 2, 25], [-18, 7, -3, 37], [16, 12, 3, 41], [49, -4, -2, 28]],
    },
    {
      x: 1400, y: 670, z: -960, scale: 2.48, speed: -10.3, phase: 3.2,
      lobes: [[-56, -6, 3, 27], [-27, 13, 0, 40], [9, 4, -4, 36], [43, 15, 2, 43], [70, -7, 0, 24]],
    },
    {
      x: 1760, y: 1080, z: 1980, scale: 2.28, speed: -9.6, phase: 5.8,
      lobes: [[-45, -7, 0, 26], [-12, 11, 3, 39], [24, 3, -3, 34], [52, -8, 2, 23]],
    },
    {
      x: -1500, y: 950, z: 850, scale: 2.9, speed: -10.2, phase: 5.4,
      lobes: [[-62, -8, 2, 25], [-35, 8, -3, 36], [0, 0, 5, 44], [34, 17, 0, 49], [67, -4, -2, 32]],
    },
    {
      x: -850, y: 1150, z: 1050, scale: 2.32, speed: -9.7, phase: 0.9,
      lobes: [[-43, -7, 1, 26], [-13, 8, -2, 38], [22, 2, 4, 33], [49, -9, 0, 22]],
    },
  ];
  for (const [cloudIndex, setting] of cloudSettings.entries()) {
    const cloud = createLowPolyCloud(cloudIndex, setting.lobes, cloudMaterial);
    cloud.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      object.renderOrder = 6;
    });
    cloud.position.set(setting.x, setting.y, setting.z);
    cloud.scale.setScalar(setting.scale);
    cloud.name = "Manhattan overview cloud";
    overlayScene.add(cloud);
    travelers.push({
      group: cloud,
      view: "manhattan",
      speed: setting.speed,
      phase: setting.phase,
      startX: -3000,
      endX: 3400,
      baseY: setting.y,
    });
  }

  const planeSettings = [
    { x: -430, y: 940, z: 1150, speed: -48, phase: 0.8, scale: 1 },
    { x: 890, y: 760, z: -1650, speed: 39, phase: 3.7, scale: 0.82 },
  ];
  planeSettings.forEach((setting, index) => {
    const plane = createPassengerPlane();
    plane.position.set(setting.x, setting.y, setting.z);
    plane.rotation.y = setting.speed < 0 ? Math.PI / 2 : -Math.PI / 2;
    plane.scale.setScalar(setting.scale);
    overlayScene.add(plane);
    travelers.push({
      group: plane,
      view: "manhattan",
      axis: "z",
      speed: setting.speed,
      phase: setting.phase,
      startX: -1750,
      endX: 1250,
      baseY: setting.y,
    });
  });

  const boat = createPassengerBoat();
  boat.position.set(-1620, 5.5, 820);
  boat.name = "Small Hudson River passenger boat";
  scene.add(boat);
  travelers.push({
    group: boat,
    view: "manhattan",
    axis: "z",
    speed: -12,
    phase: 2.1,
    startX: -2050,
    endX: 1200,
    baseY: 5.5,
    bobAmount: 0.35,
  });
  return travelers;
}
