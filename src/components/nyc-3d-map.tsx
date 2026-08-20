"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

type Point3 = [number, number, number];
type SurfaceKind = "ground" | "roof" | "wall";

interface CityGmlSurface {
  kind: SurfaceKind;
  ring: Point3[];
  holes: Point3[][];
  color?: THREE.Color;
}

interface WashingtonCityGmlData {
  buildings: Array<{
    bin: string | null;
    doittId: string | null;
    sourceId: string | null;
    surfaces: CityGmlSurface[];
  }>;
}

interface WashingtonPlanimetricsData {
  roadbeds: Array<{
    ring: Array<[number, number]>;
    holes: Array<Array<[number, number]>>;
  }>;
}

interface WashingtonParkData {
  paths: Array<{
    sourceId: string;
    kind: "footway" | "path" | "pedestrian";
    width: number;
    points: Array<[number, number]>;
  }>;
  crossings: Array<{ sourceId: string; point: [number, number]; angle: number }>;
  fountain: { sourceId: string; ring: Array<[number, number]> } | null;
  arch: { sourceId: string; height: number; footprint: Array<[number, number]> } | null;
}

const PARK_CENTER = new THREE.Vector3(0, 0, 0);
const LOAD_LOG_PREFIX = "[WashingtonSquare load]";

function createLoadLogger() {
  const startedAt = performance.now();
  return (stage: string, details: Record<string, unknown> = {}) => {
    console.info(LOAD_LOG_PREFIX, stage, {
      elapsedMs: Math.round(performance.now() - startedAt),
      ...details,
    });
  };
}

interface SkyTraveler {
  group: THREE.Group;
  speed: number;
  phase: number;
  startX: number;
  endX: number;
  baseY: number;
  flap?: (elapsed: number) => void;
}

interface AmbientAnimation {
  update: (elapsed: number) => void;
}

function projectedRing(ring: Point3[], normal: THREE.Vector3) {
  const axis = normal.clone().set(Math.abs(normal.x), Math.abs(normal.y), Math.abs(normal.z));
  if (axis.x >= axis.y && axis.x >= axis.z) return ring.map(([, y, z]) => new THREE.Vector2(z, y));
  if (axis.y >= axis.z) return ring.map(([x, , z]) => new THREE.Vector2(x, z));
  return ring.map(([x, y]) => new THREE.Vector2(x, y));
}

function surfaceNormal(ring: Point3[]) {
  const normal = new THREE.Vector3();
  for (let index = 0; index < ring.length; index += 1) {
    const current = ring[index];
    const next = ring[(index + 1) % ring.length];
    normal.x += (current[1] - next[1]) * (current[2] + next[2]);
    normal.y += (current[2] - next[2]) * (current[0] + next[0]);
    normal.z += (current[0] - next[0]) * (current[1] + next[1]);
  }
  return normal.normalize();
}

function makeSurfaceGeometry(surfaces: CityGmlSurface[]) {
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  for (const surface of surfaces) {
    if (surface.ring.length < 3) continue;
    const normal = surfaceNormal(surface.ring);
    const contour = projectedRing(surface.ring, normal);
    const holes = surface.holes.map((hole) => projectedRing(hole, normal));
    const rings = [surface.ring, ...surface.holes];
    const offset = positions.length / 3;
    for (const ring of rings) {
      for (const point of ring) {
        positions.push(...point);
        if (surface.color) colors.push(surface.color.r, surface.color.g, surface.color.b);
      }
    }
    for (const face of THREE.ShapeUtils.triangulateShape(contour, holes)) {
      indices.push(offset + face[0], offset + face[1], offset + face[2]);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  if (colors.length === positions.length) {
    geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  }
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

const BUILDING_PALETTE = [
  0xb9a98d,
  0xc49b72,
  0xa96f61,
  0xb77b5f,
  0x788878,
  0x858983,
  0xd2c3a6,
  0x71675c,
];

const LANDMARK_PALETTE: Record<string, Record<SurfaceKind, number>> = {
  // One Fifth Avenue: weathered Art Deco limestone and masonry.
  "1008847": { wall: 0xa3a39b, roof: 0xc2bdb2, ground: 0xb0aea5 },
  // NYU Silver Center / Graduate School of Arts and Science complex.
  "1008820": { wall: 0xd1cec5, roof: 0xe1dbcf, ground: 0xd7d3ca },
  // NYU Lipton Hall, 33–34 Washington Square West.
  "1008875": { wall: 0x956553, roof: 0xb8aa9b, ground: 0x806056 },
};

function buildingColor(id: string, kind: SurfaceKind) {
  const landmarkColor = LANDMARK_PALETTE[id]?.[kind];
  if (landmarkColor !== undefined) return new THREE.Color(landmarkColor);
  let hash = 2166136261;
  for (let index = 0; index < id.length; index += 1) {
    hash ^= id.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  const color = new THREE.Color(BUILDING_PALETTE[Math.abs(hash) % BUILDING_PALETTE.length]);
  if (kind === "roof") color.offsetHSL(0, -0.05, 0.1);
  if (kind === "ground") color.offsetHSL(0, -0.08, 0.025);
  return color;
}

function createParkPaths(paths: WashingtonParkData["paths"], material: THREE.Material) {
  const segments = paths.flatMap((path) => path.points.slice(1).map((point, index) => ({
    from: path.points[index],
    to: point,
    width: Math.min(path.width, 6),
  })));
  const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), material, segments.length);
  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  const rotation = new THREE.Euler();
  segments.forEach((segment, index) => {
    const dx = segment.to[0] - segment.from[0];
    const dz = segment.to[1] - segment.from[1];
    const length = Math.hypot(dx, dz);
    position.set((segment.from[0] + segment.to[0]) / 2, 0.76, (segment.from[1] + segment.to[1]) / 2);
    quaternion.setFromEuler(rotation.set(0, Math.atan2(dx, dz), 0));
    scale.set(segment.width, 0.12, length + 0.25);
    matrix.compose(position, quaternion, scale);
    mesh.setMatrixAt(index, matrix);
  });
  mesh.receiveShadow = true;
  mesh.name = "OpenStreetMap Washington Square paths";
  return mesh;
}

function createSimpleArch(data: NonNullable<WashingtonParkData["arch"]>, material: THREE.Material) {
  const footprint = data.footprint.slice(0, -1);
  const center = footprint.reduce((sum, point) => [sum[0] + point[0], sum[1] + point[1]], [0, 0]).map((value) => value / footprint.length);
  const edge = [footprint[1][0] - footprint[0][0], footprint[1][1] - footprint[0][1]];
  const width = Math.hypot(...edge);
  const depth = Math.hypot(footprint[2][0] - footprint[1][0], footprint[2][1] - footprint[1][1]);
  const openingWidth = width * 0.42;
  const pierWidth = (width - openingWidth) / 2;
  const openingHeight = data.height * 0.62;
  const arch = new THREE.Group();
  const addPart = (size: [number, number, number], x: number, y: number) => {
    const part = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
    part.position.set(x, y, 0);
    part.castShadow = true;
    part.receiveShadow = true;
    arch.add(part);
  };
  addPart([pierWidth, openingHeight, depth], -(openingWidth + pierWidth) / 2, openingHeight / 2);
  addPart([pierWidth, openingHeight, depth], (openingWidth + pierWidth) / 2, openingHeight / 2);
  addPart([width, data.height - openingHeight, depth], 0, openingHeight + (data.height - openingHeight) / 2);
  addPart([width * 1.08, 0.65, depth * 1.08], 0, data.height - 2.2);
  addPart([width * 0.82, 0.7, depth * 1.04], 0, data.height + 0.35);
  arch.position.set(center[0], 0.68, center[1]);
  arch.rotation.y = -Math.atan2(edge[1], edge[0]);
  arch.name = "OpenStreetMap Washington Square Arch";
  return arch;
}

function loadBlenderArch(
  data: NonNullable<WashingtonParkData["arch"]>,
  onLoad: (arch: THREE.Group) => void,
  onError: () => void,
) {
  const startedAt = performance.now();
  new GLTFLoader().load("/models/washington-square-arch.glb", (gltf) => {
    const model = gltf.scene;
    const white = new THREE.MeshStandardMaterial({
      color: 0xf1ede4,
      roughness: 0.86,
      side: THREE.DoubleSide,
    });
    model.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.material = white;
        object.castShadow = true;
        object.receiveShadow = true;
      }
    });
    const bounds = new THREE.Box3().setFromObject(model);
    const size = bounds.getSize(new THREE.Vector3());
    const center = bounds.getCenter(new THREE.Vector3());
    const normalized = new THREE.Group();
    model.position.set(-center.x, -bounds.min.y, -center.z);
    normalized.add(model);
    normalized.scale.setScalar(data.height / size.y);

    const footprint = data.footprint.slice(0, -1);
    const location = footprint.reduce((sum, point) => [sum[0] + point[0], sum[1] + point[1]], [0, 0]).map((value) => value / footprint.length);
    const edge = [footprint[1][0] - footprint[0][0], footprint[1][1] - footprint[0][1]];
    normalized.position.set(location[0], 0.68, location[1]);
    normalized.rotation.y = -Math.atan2(edge[1], edge[0]);
    normalized.name = "White Sketchfab Washington Square Arch";
    console.info(LOAD_LOG_PREFIX, "Arch GLB ready", {
      elapsedMs: Math.round(performance.now() - startedAt),
      meshes: model.children.length,
    });
    onLoad(normalized);
  }, undefined, (error) => {
    console.warn(LOAD_LOG_PREFIX, "Arch GLB failed", { elapsedMs: Math.round(performance.now() - startedAt), error });
    onError();
  });
}

const BOBST_BIN = "1008626";

function loadBobstLibrary(onLoad: (building: THREE.Group) => void, onError: () => void) {
  const startedAt = performance.now();
  new GLTFLoader().load("/models/bobst-library.glb", (gltf) => {
    const building = gltf.scene;
    building.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        for (const material of materials) {
          if (material instanceof THREE.MeshStandardMaterial) {
            material.roughness = 0.88;
            material.metalness = 0;
          }
        }
        object.castShadow = true;
        object.receiveShadow = true;
      }
    });
    building.scale.set(69.633 / 33.586, 51.086 / 28.004, 64.53 / 36.674);
    // Follow the long Washington Square South facade edge rather than the
    // irregular footprint's PCA axis, which over-rotates the building.
    building.rotation.y = 0.998781;
    building.position.set(9.692, 2.688, 154.508);
    building.name = "Corrected Sketchfab Bobst Library";
    let meshes = 0;
    building.traverse((object) => {
      if (object instanceof THREE.Mesh) meshes += 1;
    });
    console.info(LOAD_LOG_PREFIX, "Bobst GLB ready", {
      elapsedMs: Math.round(performance.now() - startedAt),
      meshes,
    });
    onLoad(building);
  }, undefined, (error) => {
    console.warn(LOAD_LOG_PREFIX, "Bobst GLB failed", { elapsedMs: Math.round(performance.now() - startedAt), error });
    onError();
  });
}

function createCrosswalks(data: WashingtonParkData["crossings"], material: THREE.Material) {
  const crossings = new THREE.Group();
  const addCrosswalk = (x: number, z: number, angle: number) => {
    const crossing = new THREE.Group();
    for (let stripe = -3; stripe <= 3; stripe += 1) {
      const marking = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.065, 5.2), material);
      marking.position.x = stripe * 1.72;
      marking.receiveShadow = true;
      marking.renderOrder = 3;
      crossing.add(marking);
    }
    crossing.position.set(x, 0.82, z);
    crossing.rotation.y = -angle;
    crossings.add(crossing);
  };

  for (const crossing of data) addCrosswalk(crossing.point[0], crossing.point[1], crossing.angle);

  crossings.name = "Washington Square crosswalk markings";
  crossings.renderOrder = 2;
  return crossings;
}

function createCartoonBird(scale: number, color: number, isPigeon: boolean) {
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

function createSkyTravelers(scene: THREE.Scene) {
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

function seededRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = Math.imul(state ^ (state >>> 15), 1 | state);
    state ^= state + Math.imul(state ^ (state >>> 7), 61 | state);
    return ((state ^ (state >>> 14)) >>> 0) / 4294967296;
  };
}

function pointInRing(x: number, z: number, ring: Array<[number, number]>) {
  let inside = false;
  for (let current = 0, previous = ring.length - 1; current < ring.length; previous = current, current += 1) {
    const [currentX, currentZ] = ring[current];
    const [previousX, previousZ] = ring[previous];
    if (((currentZ > z) !== (previousZ > z))
      && x < ((previousX - currentX) * (z - currentZ)) / (previousZ - currentZ) + currentX) {
      inside = !inside;
    }
  }
  return inside;
}

interface FootprintIndex {
  cellSize: number;
  cells: Map<string, Array<Array<[number, number]>>>;
}

function createFootprintIndex(footprints: Array<Array<[number, number]>>, cellSize = 64): FootprintIndex {
  const cells = new Map<string, Array<Array<[number, number]>>>();
  for (const ring of footprints) {
    const xs = ring.map(([x]) => x);
    const zs = ring.map(([, z]) => z);
    const minX = Math.floor(Math.min(...xs) / cellSize);
    const maxX = Math.floor(Math.max(...xs) / cellSize);
    const minZ = Math.floor(Math.min(...zs) / cellSize);
    const maxZ = Math.floor(Math.max(...zs) / cellSize);
    for (let cellX = minX; cellX <= maxX; cellX += 1) {
      for (let cellZ = minZ; cellZ <= maxZ; cellZ += 1) {
        const key = `${cellX}:${cellZ}`;
        const entries = cells.get(key) ?? [];
        entries.push(ring);
        cells.set(key, entries);
      }
    }
  }
  return { cellSize, cells };
}

function collidesWithFootprints(x: number, z: number, index: FootprintIndex, margin: number) {
  const probes = [[0, 0], [margin, 0], [-margin, 0], [0, margin], [0, -margin]];
  return probes.some(([offsetX, offsetZ]) => {
    const probeX = x + offsetX;
    const probeZ = z + offsetZ;
    const key = `${Math.floor(probeX / index.cellSize)}:${Math.floor(probeZ / index.cellSize)}`;
    return (index.cells.get(key) ?? []).some((ring) => pointInRing(probeX, probeZ, ring));
  });
}

function createPedestrians(
  scene: THREE.Scene,
  city: WashingtonCityGmlData,
  planimetrics: WashingtonPlanimetricsData,
): AmbientAnimation {
  const count = 300;
  const random = seededRandom(0x57a5_2026);
  const buildingFootprints = city.buildings.flatMap((building) => building.surfaces
    .filter((surface) => surface.kind === "ground")
    .map((surface) => surface.ring.map(([x, , z]) => [x, z] as [number, number])));
  const roadFootprints = planimetrics.roadbeds.map((roadbed) => roadbed.ring);
  const buildingIndex = createFootprintIndex(buildingFootprints);
  const roadIndex = createFootprintIndex(roadFootprints);
  const walkers: Array<{ x: number; z: number; heading: number; phase: number; radius: number; speed: number }> = [];

  for (let attempt = 0; walkers.length < count && attempt < 50000; attempt += 1) {
    const x = (random() - 0.5) * 1260;
    const z = (random() - 0.5) * 1260;
    if (x * x + z * z > 620 * 620) continue;
    const walker = {
      x,
      z,
      heading: random() * Math.PI * 2,
      phase: random() * Math.PI * 2,
      radius: 1.5 + random() * 5,
      speed: 0.18 + random() * 0.22,
    };
    const entireRouteIsClear = Array.from({ length: 16 }, (_, sample) => {
      const angle = (sample / 16) * Math.PI * 2;
      const routeX = walker.x + Math.cos(angle) * walker.radius;
      const routeZ = walker.z + Math.sin(angle) * walker.radius;
      return !collidesWithFootprints(routeX, routeZ, roadIndex, 1.2)
        && !collidesWithFootprints(routeX, routeZ, buildingIndex, 1.8);
    }).every(Boolean);
    if (entireRouteIsClear) walkers.push(walker);
  }

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
  bodies.castShadow = true;
  heads.castShadow = true;
  bodies.name = "300 low-detail walking pedestrians";
  heads.name = "Pedestrian heads";
  scene.add(bodies, heads);

  const bodyMatrix = new THREE.Matrix4();
  const headMatrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  const scale = new THREE.Vector3(1, 1, 1);
  return {
    update: (elapsed) => {
      walkers.forEach((walker, index) => {
        const angle = walker.heading + elapsed * walker.speed;
        const x = walker.x + Math.cos(angle) * walker.radius;
        const z = walker.z + Math.sin(angle) * walker.radius;
        const bob = Math.abs(Math.sin(elapsed * 5 + walker.phase)) * 0.16;
        quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), -angle + Math.PI / 2);
        bodyMatrix.compose(position.set(x, 2.15 + bob, z), quaternion, scale);
        headMatrix.compose(position.set(x, 4.02 + bob, z), quaternion, scale);
        bodies.setMatrixAt(index, bodyMatrix);
        heads.setMatrixAt(index, headMatrix);
      });
      bodies.instanceMatrix.needsUpdate = true;
      heads.instanceMatrix.needsUpdate = true;
    },
  };
}

function createTraffic(
  scene: THREE.Scene,
  city: WashingtonCityGmlData,
  planimetrics: WashingtonPlanimetricsData,
): AmbientAnimation {
  const count = 100;
  const random = seededRandom(0xca45_2026);
  const buildingFootprints = city.buildings.flatMap((building) => building.surfaces
    .filter((surface) => surface.kind === "ground")
    .map((surface) => surface.ring.map(([x, , z]) => [x, z] as [number, number])));
  const buildingIndex = createFootprintIndex(buildingFootprints);
  const verifiedRoutes: Array<{ start: THREE.Vector2; end: THREE.Vector2 }> = [];
  for (const roadbed of planimetrics.roadbeds) {
    const ring = roadbed.ring;
    if (ring.length < 4) continue;
    const center = ring.reduce((sum, [x, z]) => sum.add(new THREE.Vector2(x, z)), new THREE.Vector2()).multiplyScalar(1 / ring.length);
    let xx = 0;
    let xz = 0;
    let zz = 0;
    for (const [x, z] of ring) {
      const dx = x - center.x;
      const dz = z - center.y;
      xx += dx * dx;
      xz += dx * dz;
      zz += dz * dz;
    }
    const trace = xx + zz;
    const discriminant = Math.sqrt((xx - zz) ** 2 + 4 * xz ** 2);
    const majorVariance = (trace + discriminant) / 2;
    const minorVariance = Math.max((trace - discriminant) / 2, 0.001);
    if (majorVariance / minorVariance < 2.4) continue;
    const angle = 0.5 * Math.atan2(2 * xz, xx - zz);
    const direction = new THREE.Vector2(Math.cos(angle), Math.sin(angle));
    const perpendicular = new THREE.Vector2(-direction.y, direction.x);
    const projections = ring.map(([x, z]) => new THREE.Vector2(x, z).sub(center).dot(direction));
    const minimum = Math.min(...projections);
    const maximum = Math.max(...projections);
    if (maximum - minimum < 28) continue;

    const samples = Array.from({ length: 121 }, (_, index) => {
      const distance = THREE.MathUtils.lerp(minimum, maximum, index / 120);
      const point = center.clone().addScaledVector(direction, distance);
      const acrossRoadIsClear = [-1.45, 0, 1.45].every((laneOffset) => {
        const probe = point.clone().addScaledVector(perpendicular, laneOffset);
        return pointInRing(probe.x, probe.y, ring)
          && !roadbed.holes.some((hole) => pointInRing(probe.x, probe.y, hole))
          && !collidesWithFootprints(probe.x, probe.y, buildingIndex, 3.2);
      });
      return { point, clear: acrossRoadIsClear };
    });
    let bestStart = -1;
    let bestEnd = -1;
    let runStart = -1;
    samples.forEach((sample, index) => {
      if (sample.clear && runStart < 0) runStart = index;
      if ((!sample.clear || index === samples.length - 1) && runStart >= 0) {
        const runEnd = sample.clear ? index : index - 1;
        if (runEnd - runStart > bestEnd - bestStart) {
          bestStart = runStart;
          bestEnd = runEnd;
        }
        runStart = -1;
      }
    });
    if (bestEnd - bestStart < 8) continue;
    verifiedRoutes.push({
      start: samples[bestStart + 2].point,
      end: samples[bestEnd - 2].point,
    });
  }

  const cars: Array<{ start: THREE.Vector2; end: THREE.Vector2; speed: number; offset: number }> = [];
  for (let index = 0; index < count; index += 1) {
    const route = verifiedRoutes[Math.floor(random() * verifiedRoutes.length)];
    const reversed = random() > 0.5;
    cars.push({
      start: (reversed ? route.end : route.start).clone(),
      end: (reversed ? route.start : route.end).clone(),
      speed: 0.025 + random() * 0.025,
      offset: random(),
    });
  }

  const chassis = new THREE.InstancedMesh(
    new THREE.BoxGeometry(5.8, 1.45, 2.65),
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85 }),
    count,
  );
  const cabins = new THREE.InstancedMesh(
    new THREE.BoxGeometry(3.2, 1.15, 2.25),
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8 }),
    count,
  );
  const carColors = [0x65717a, 0xd8d4ca, 0xf2b71d];
  cars.forEach((_, index) => {
    const color = new THREE.Color(index % 3 === 2 ? 0xf2b71d : carColors[index % 2]);
    chassis.setColorAt(index, color);
    cabins.setColorAt(index, color.clone().offsetHSL(0, -0.08, 0.08));
  });
  chassis.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  cabins.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  chassis.castShadow = true;
  cabins.castShadow = true;
  chassis.name = "100 road-verified low-detail cars with every third car a yellow taxi";
  cabins.name = "Low-detail car cabins";
  scene.add(chassis, cabins);

  const chassisMatrix = new THREE.Matrix4();
  const cabinMatrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  const scale = new THREE.Vector3(1, 1, 1);
  return {
    update: (elapsed) => {
      cars.forEach((car, index) => {
        const progress = (car.offset + elapsed * car.speed) % 1;
        const x = THREE.MathUtils.lerp(car.start.x, car.end.x, progress);
        const z = THREE.MathUtils.lerp(car.start.y, car.end.y, progress);
        const heading = Math.atan2(-(car.end.y - car.start.y), car.end.x - car.start.x);
        quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), heading);
        chassisMatrix.compose(position.set(x, 1.55, z), quaternion, scale);
        cabinMatrix.compose(position.set(x, 2.62, z), quaternion, scale);
        chassis.setMatrixAt(index, chassisMatrix);
        cabins.setMatrixAt(index, cabinMatrix);
      });
      chassis.instanceMatrix.needsUpdate = true;
      cabins.instanceMatrix.needsUpdate = true;
    },
  };
}

function createLiptonWindows(scene: THREE.Scene, city: WashingtonCityGmlData) {
  const lipton = city.buildings.find((building) => building.bin === "1008875");
  if (!lipton) return;
  const buildingPoints = lipton.surfaces.flatMap((surface) => surface.ring);
  const buildingCenter = buildingPoints.reduce(
    (sum, [x, , z]) => sum.add(new THREE.Vector2(x, z)),
    new THREE.Vector2(),
  ).multiplyScalar(1 / buildingPoints.length);
  const placements: Array<{ position: THREE.Vector3; rotation: THREE.Quaternion }> = [];
  const up = new THREE.Vector3(0, 1, 0);

  for (const surface of lipton.surfaces.filter((candidate) => candidate.kind === "wall")) {
    const minimumY = Math.min(...surface.ring.map((point) => point[1]));
    const maximumY = Math.max(...surface.ring.map((point) => point[1]));
    if (maximumY - minimumY < 7.5) continue;
    let facadeStart: Point3 | null = null;
    let facadeEnd: Point3 | null = null;
    let facadeWidth = 0;
    for (let index = 0; index < surface.ring.length; index += 1) {
      const start = surface.ring[index];
      const end = surface.ring[(index + 1) % surface.ring.length];
      if (Math.abs(start[1] - end[1]) > 0.45) continue;
      const width = Math.hypot(end[0] - start[0], end[2] - start[2]);
      if (width > facadeWidth) {
        facadeStart = start;
        facadeEnd = end;
        facadeWidth = width;
      }
    }
    if (!facadeStart || !facadeEnd || facadeWidth < 5.5) continue;
    const direction = new THREE.Vector3(
      (facadeEnd[0] - facadeStart[0]) / facadeWidth,
      0,
      (facadeEnd[2] - facadeStart[2]) / facadeWidth,
    );
    const facadeCenter = new THREE.Vector2(
      (facadeStart[0] + facadeEnd[0]) / 2,
      (facadeStart[2] + facadeEnd[2]) / 2,
    );
    const normal = new THREE.Vector2(-direction.z, direction.x);
    if (normal.dot(facadeCenter.clone().sub(buildingCenter)) < 0) normal.multiplyScalar(-1);
    const columns = Math.max(1, Math.floor(facadeWidth / 3.15));
    const floors = Math.max(1, Math.floor((maximumY - minimumY - 2.4) / 3.25));
    const rotation = new THREE.Quaternion().setFromAxisAngle(up, Math.atan2(-direction.z, direction.x));
    for (let floor = 0; floor < floors; floor += 1) {
      const y = minimumY + 2.25 + floor * 3.25;
      if (y > maximumY - 1.1) break;
      for (let column = 0; column < columns; column += 1) {
        const distance = ((column + 1) / (columns + 1)) * facadeWidth;
        placements.push({
          position: new THREE.Vector3(
            facadeStart[0] + direction.x * distance + normal.x * 0.18,
            y,
            facadeStart[2] + direction.z * distance + normal.y * 0.18,
          ),
          rotation,
        });
      }
    }
  }

  const windows = new THREE.InstancedMesh(
    new THREE.BoxGeometry(1.45, 1.75, 0.16),
    new THREE.MeshStandardMaterial({ color: 0x667477, roughness: 0.55, metalness: 0.06 }),
    placements.length,
  );
  const matrix = new THREE.Matrix4();
  const scale = new THREE.Vector3(1, 1, 1);
  placements.forEach((placement, index) => {
    matrix.compose(placement.position, placement.rotation, scale);
    windows.setMatrixAt(index, matrix);
  });
  windows.castShadow = true;
  windows.name = "Lipton Hall floor-by-floor facade windows";
  scene.add(windows);
}

export default function Nyc3dMap() {
  const mountRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState("Building Washington Square");

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    const logLoad = createLoadLogger();
    let disposed = false;
    let frame = 0;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xe8e4d9);
    scene.fog = new THREE.Fog(0xe8e4d9, 920, 1700);

    const camera = new THREE.OrthographicCamera(-500, 500, 390, -390, 10, 3500);
    const cameraTarget = PARK_CENTER.clone().add(new THREE.Vector3(0, 28, 0));
    const cameraHeight = 560;
    const cameraRadius = 630;
    let cameraAzimuth = 0;
    const updateCamera = () => {
      camera.position.set(
        cameraTarget.x + Math.sin(cameraAzimuth) * cameraRadius,
        cameraHeight,
        cameraTarget.z + Math.cos(cameraAzimuth) * cameraRadius,
      );
      camera.lookAt(cameraTarget);
    };
    updateCamera();

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: "high-performance",
      stencil: true,
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.94;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.domElement.className = "washington-canvas";
    mount.appendChild(renderer.domElement);
    logLoad("Renderer ready", {
      pixelRatio: renderer.getPixelRatio(),
      viewport: `${mount.clientWidth}x${mount.clientHeight}`,
    });

    scene.add(new THREE.HemisphereLight(0xfff4dc, 0x87908c, 1.9));
    const sun = new THREE.DirectionalLight(0xffdca8, 1.4);
    sun.position.copy(PARK_CENTER).add(new THREE.Vector3(-720, 1080, 460));
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -850;
    sun.shadow.camera.right = 850;
    sun.shadow.camera.top = 850;
    sun.shadow.camera.bottom = -850;
    sun.shadow.bias = -0.00015;
    sun.shadow.radius = 6;
    scene.add(sun);
    const skyTravelers = createSkyTravelers(scene);
    const ambientAnimations: AmbientAnimation[] = [];
    const timer = new THREE.Timer();
    timer.connect(document);

    const sidewalkMaterial = new THREE.MeshStandardMaterial({
      color: 0xaaa9a1,
      roughness: 1,
      stencilWrite: true,
      stencilRef: 1,
      stencilFunc: THREE.NotEqualStencilFunc,
    });
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(2200, 2200), sidewalkMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.position.copy(PARK_CENTER).setY(0.68);
    ground.receiveShadow = true;
    scene.add(ground);

    logLoad("Data requests started");
    Promise.all([
      fetch("/data/washington-square-citygml.json"),
      fetch("/data/washington-square-planimetrics.json"),
      fetch("/data/washington-square-park.json"),
    ])
      .then(async ([cityResponse, planimetricsResponse, parkResponse]) => {
        if (!cityResponse.ok) throw new Error(`CityGML request failed (${cityResponse.status})`);
        if (!planimetricsResponse.ok) throw new Error(`Planimetrics request failed (${planimetricsResponse.status})`);
        if (!parkResponse.ok) throw new Error(`Park data request failed (${parkResponse.status})`);
        logLoad("Data responses received", {
          cityBytes: Number(cityResponse.headers.get("content-length")) || null,
          planimetricsBytes: Number(planimetricsResponse.headers.get("content-length")) || null,
          parkBytes: Number(parkResponse.headers.get("content-length")) || null,
        });
        return Promise.all([
          cityResponse.json() as Promise<WashingtonCityGmlData>,
          planimetricsResponse.json() as Promise<WashingtonPlanimetricsData>,
          parkResponse.json() as Promise<WashingtonParkData>,
        ]);
      })
      .then(([data, planimetrics, park]) => {
        if (disposed) return;
        logLoad("JSON parsed", {
          buildings: data.buildings.length,
          roadbeds: planimetrics.roadbeds.length,
          parkPaths: park.paths.length,
        });
        ambientAnimations.push(
          createPedestrians(scene, data, planimetrics),
          createTraffic(scene, data, planimetrics),
        );
        createLiptonWindows(scene, data);
        logLoad("Ambient geometry ready");
        const roadSurfaces: CityGmlSurface[] = planimetrics.roadbeds.map((roadbed) => ({
          kind: "ground",
          ring: roadbed.ring.map(([x, z]) => [x, 0.12, z]),
          holes: roadbed.holes.map((hole) => hole.map(([x, z]) => [x, 0.12, z])),
        }));
        const roadMaterial = new THREE.MeshStandardMaterial({
          color: 0x6f6a61,
          roughness: 1,
          side: THREE.DoubleSide,
          stencilWrite: true,
          stencilRef: 1,
          stencilFunc: THREE.AlwaysStencilFunc,
          stencilZPass: THREE.ReplaceStencilOp,
        });
        const roads = new THREE.Mesh(
          makeSurfaceGeometry(roadSurfaces),
          roadMaterial,
        );
        roads.renderOrder = -1;
        ground.renderOrder = 0;
        roads.receiveShadow = true;
        roads.name = "NYC 2022 planimetric roadbeds";
        scene.add(roads);
        scene.add(createCrosswalks(park.crossings, new THREE.MeshBasicMaterial({
          color: 0xfffdf5,
          depthTest: true,
          depthWrite: true,
        })));
        scene.add(createParkPaths(
          park.paths,
          new THREE.MeshStandardMaterial({ color: 0xc6baa6, roughness: 1 }),
        ));
        logLoad("Road and park geometry ready");
        if (park.fountain) {
          const fountainSurface: CityGmlSurface = {
            kind: "ground",
            ring: park.fountain.ring.map(([x, z]) => [x, 0.8, z]),
            holes: [],
          };
          const fountain = new THREE.Mesh(
            makeSurfaceGeometry([fountainSurface]),
            new THREE.MeshStandardMaterial({ color: 0xb8c2c0, roughness: 0.9, side: THREE.DoubleSide }),
          );
          fountain.name = "OpenStreetMap Washington Square fountain footprint";
          scene.add(fountain);
        }
        if (park.arch) {
          loadBlenderArch(park.arch, (arch) => {
            if (disposed) {
              arch.traverse((object) => {
                if (object instanceof THREE.Mesh) object.geometry.dispose();
              });
              return;
            }
            scene.add(arch);
          }, () => {
            if (!disposed) scene.add(createSimpleArch(
              park.arch!,
              new THREE.MeshStandardMaterial({ color: 0xf1ede4, roughness: 0.86 }),
            ));
          });
        }

        const surfaces: Record<SurfaceKind, CityGmlSurface[]> = { ground: [], roof: [], wall: [] };
        const bobstFallback: Record<SurfaceKind, CityGmlSurface[]> = { ground: [], roof: [], wall: [] };
        for (const building of data.buildings) {
          if (building.bin === "1088400") continue;
          const id = building.bin ?? building.doittId ?? building.sourceId ?? "building";
          for (const surface of building.surfaces) {
            const target = id === BOBST_BIN ? bobstFallback : surfaces;
            target[surface.kind].push({ ...surface, color: buildingColor(id, surface.kind) });
          }
        }
        const materials: Record<SurfaceKind, THREE.MeshStandardMaterial> = {
          roof: new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 1, side: THREE.DoubleSide }),
          wall: new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 1, side: THREE.DoubleSide }),
          ground: new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 1, side: THREE.DoubleSide }),
        };
        for (const kind of ["ground", "wall", "roof"] as const) {
          const mesh = new THREE.Mesh(makeSurfaceGeometry(surfaces[kind]), materials[kind]);
          mesh.castShadow = kind !== "ground";
          mesh.receiveShadow = true;
          mesh.name = `NYC CityGML ${kind} surfaces`;
          scene.add(mesh);
        }
        logLoad("CityGML geometry ready", {
          groundSurfaces: surfaces.ground.length,
          wallSurfaces: surfaces.wall.length,
          roofSurfaces: surfaces.roof.length,
        });
        loadBobstLibrary((bobst) => {
          if (!disposed) scene.add(bobst);
        }, () => {
          if (disposed) return;
          for (const kind of ["ground", "wall", "roof"] as const) {
            const mesh = new THREE.Mesh(makeSurfaceGeometry(bobstFallback[kind]), materials[kind]);
            mesh.castShadow = kind !== "ground";
            mesh.receiveShadow = true;
            mesh.name = `Bobst CityGML ${kind} fallback`;
            scene.add(mesh);
          }
        });
        setStatus("");
        logLoad("Scene ready");
      })
      .catch((error: Error) => {
        console.error(LOAD_LOG_PREFIX, "Scene load failed", error);
        setStatus(error.message);
      });

    const resize = () => {
      if (!mount.clientWidth || !mount.clientHeight) return;
      const height = 546;
      const width = height * (mount.clientWidth / mount.clientHeight);
      camera.left = -width / 2;
      camera.right = width / 2;
      camera.top = height / 2;
      camera.bottom = -height / 2;
      camera.updateProjectionMatrix();
      renderer.setSize(mount.clientWidth, mount.clientHeight);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(mount);
    resize();

    let dragging = false;
    let pointerX = 0;
    const pointerDown = (event: PointerEvent) => {
      dragging = true;
      pointerX = event.clientX;
      renderer.domElement.setPointerCapture(event.pointerId);
      renderer.domElement.classList.add("is-dragging");
    };
    const pointerMove = (event: PointerEvent) => {
      if (!dragging) return;
      cameraAzimuth -= (event.clientX - pointerX) * 0.005;
      pointerX = event.clientX;
      updateCamera();
    };
    const pointerUp = (event: PointerEvent) => {
      dragging = false;
      if (renderer.domElement.hasPointerCapture(event.pointerId)) renderer.domElement.releasePointerCapture(event.pointerId);
      renderer.domElement.classList.remove("is-dragging");
    };
    renderer.domElement.addEventListener("pointerdown", pointerDown);
    renderer.domElement.addEventListener("pointermove", pointerMove);
    renderer.domElement.addEventListener("pointerup", pointerUp);
    renderer.domElement.addEventListener("pointercancel", pointerUp);

    const animate = () => {
      frame = requestAnimationFrame(animate);
      timer.update();
      const delta = Math.min(timer.getDelta(), 0.05);
      const elapsed = timer.getElapsed();
      for (const traveler of skyTravelers) {
        const span = traveler.endX - traveler.startX;
        traveler.group.position.x = traveler.startX
          + ((traveler.group.position.x - traveler.startX + traveler.speed * delta + span) % span);
        traveler.group.position.y = traveler.baseY + Math.sin(elapsed * 0.55 + traveler.phase) * 3.5;
        traveler.flap?.(elapsed);
      }
      ambientAnimations.forEach((animation) => animation.update(elapsed));
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      renderer.domElement.removeEventListener("pointerdown", pointerDown);
      renderer.domElement.removeEventListener("pointermove", pointerMove);
      renderer.domElement.removeEventListener("pointerup", pointerUp);
      renderer.domElement.removeEventListener("pointercancel", pointerUp);
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh || object instanceof THREE.LineSegments) {
          object.geometry.dispose();
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          materials.forEach((material) => material.dispose());
        }
      });
      timer.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  return (
    <main className="washington-study">
      <div ref={mountRef} className="washington-study__viewport" />
      {status && <div className="washington-study__loading">{status}</div>}
      <a className="washington-study__credit" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">
        NYC Open Data · © OpenStreetMap contributors
      </a>
    </main>
  );
}
