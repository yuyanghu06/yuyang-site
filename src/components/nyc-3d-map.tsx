"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

type Point3 = [number, number, number];
type SurfaceKind = "ground" | "roof" | "wall";

interface CityGmlSurface {
  kind: SurfaceKind;
  ring: Point3[];
  holes: Point3[][];
  color?: THREE.Color;
}

interface WashingtonCityRuntimeData {
  footprints: Array<Array<[number, number]>>;
  details: Record<string, CityGmlSurface[]>;
}

interface WashingtonCityManifest {
  version: string;
  tileSize: number;
  buildingCount: number;
  tiles: Array<{ file: string; x: number; z: number }>;
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
  crossings: Array<{ sourceId: string; point: [number, number]; angle: number; span: number }>;
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

const BLOCKED_ZOOM_DURATION_MS = 260;
const BLOCKED_ZOOM_SCALE = 1.035;
const WHEEL_GESTURE_SETTLE_MS = BLOCKED_ZOOM_DURATION_MS;

interface ClickableLandmark {
  root: THREE.Object3D;
  glow: THREE.Object3D;
  baseY: number;
  hovered: boolean;
  selected: boolean;
}

function createBuildingGlow(source: THREE.Object3D) {
  source.updateMatrixWorld(true);
  const inverseRoot = source.matrixWorld.clone().invert();
  const glow = new THREE.Group();
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
  source.traverse((object) => {
    if (!(object instanceof THREE.Mesh) || object instanceof THREE.InstancedMesh) return;
    const geometry = object.geometry.clone();
    geometry.applyMatrix4(inverseRoot.clone().multiply(object.matrixWorld));
    const surface = new THREE.Mesh(geometry, material);
    surface.renderOrder = 4;
    surface.raycast = () => undefined;
    glow.add(surface);
  });
  glow.name = "Clickable landmark surface glow";
  return glow;
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

function createWashingtonSquareTrees(park: WashingtonParkData) {
  const random = seededRandom(0x7ee5_2026);
  const positions: Array<{
    x: number;
    z: number;
    trunkScale: number;
    heightScale: number;
    crownScale: [number, number, number];
    crownColor: number;
  }> = [];
  const crownPalette = [0x91ad72, 0xa5bf82, 0x7f9d67, 0xb2c990, 0x8eaa70];
  const distanceToSegment = (x: number, z: number, from: [number, number], to: [number, number]) => {
    const dx = to[0] - from[0];
    const dz = to[1] - from[1];
    const lengthSquared = dx * dx + dz * dz;
    const t = lengthSquared === 0 ? 0 : THREE.MathUtils.clamp(((x - from[0]) * dx + (z - from[1]) * dz) / lengthSquared, 0, 1);
    return Math.hypot(x - (from[0] + dx * t), z - (from[1] + dz * t));
  };
  const localPathSegments = park.paths.flatMap((path) => path.points.slice(1).map((point, index) => ({
    from: path.points[index],
    to: point,
    clearance: Math.min(path.width, 6) / 2 + 4.4,
  }))).filter(({ from, to }) => Math.hypot(from[0], from[1]) < 230 || Math.hypot(to[0], to[1]) < 230);
  const fountainCenter = park.fountain
    ? park.fountain.ring.reduce((sum, [x, z]) => [sum[0] + x, sum[1] + z] as [number, number], [0, 0] as [number, number])
      .map((value) => value / park.fountain!.ring.length) as [number, number]
    : [0, 0] as [number, number];
  const fountainRadius = park.fountain
    ? park.fountain.ring.reduce((sum, [x, z]) => sum + Math.hypot(x - fountainCenter[0], z - fountainCenter[1]), 0) / park.fountain.ring.length
    : 0;
  const archCenter = park.arch
    ? park.arch.footprint.slice(0, -1).reduce((sum, [x, z]) => [sum[0] + x, sum[1] + z] as [number, number], [0, 0] as [number, number])
      .map((value) => value / (park.arch!.footprint.length - 1)) as [number, number]
    : [Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY] as [number, number];

  for (let attempt = 0; positions.length < 88 && attempt < 12000; attempt += 1) {
    const x = (random() - 0.5) * 310;
    const z = (random() - 0.5) * 285 + 10;
    if ((x / 158) ** 2 + ((z - 10) / 146) ** 2 > 1) continue;
    if (Math.hypot(x - fountainCenter[0], z - fountainCenter[1]) < fountainRadius + 10) continue;
    if (Math.hypot(x - archCenter[0], z - archCenter[1]) < 16) continue;
    if (localPathSegments.some((segment) => distanceToSegment(x, z, segment.from, segment.to) < segment.clearance)) continue;
    if (positions.some((tree) => Math.hypot(x - tree.x, z - tree.z) < 10.5)) continue;
    const isTall = random() < 0.18;
    const crownSize = 0.68 + random() * 0.68;
    positions.push({
      x,
      z,
      trunkScale: 0.78 + random() * 0.38,
      heightScale: isTall ? 1.45 + random() * 0.55 : 0.88 + random() * 0.22,
      crownScale: [
        crownSize * (0.86 + random() * 0.28),
        crownSize * (0.88 + random() * 0.38),
        crownSize * (0.86 + random() * 0.28),
      ],
      crownColor: crownPalette[Math.floor(random() * crownPalette.length)],
    });
  }

  const group = new THREE.Group();
  const trunks = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.5, 0.72, 6.8, 7),
    new THREE.MeshStandardMaterial({ color: 0x66513d, roughness: 1 }),
    positions.length,
  );
  const crowns = new THREE.InstancedMesh(
    new THREE.IcosahedronGeometry(4.1, 1),
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1 }),
    positions.length,
  );
  const matrix = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion();
  positions.forEach((tree, index) => {
    matrix.compose(
      new THREE.Vector3(tree.x, 0.68 + 3.4 * tree.heightScale, tree.z),
      quaternion,
      new THREE.Vector3(tree.trunkScale, tree.heightScale, tree.trunkScale),
    );
    trunks.setMatrixAt(index, matrix);
    matrix.compose(
      new THREE.Vector3(tree.x, 0.68 + 8.2 * tree.heightScale, tree.z),
      quaternion,
      new THREE.Vector3(
        tree.crownScale[0],
        tree.crownScale[1] * tree.heightScale,
        tree.crownScale[2],
      ),
    );
    crowns.setMatrixAt(index, matrix);
    crowns.setColorAt(index, new THREE.Color(tree.crownColor));
  });
  trunks.castShadow = true;
  crowns.castShadow = true;
  group.add(trunks, crowns);
  group.name = `${positions.length} path-cleared Washington Square trees`;
  return {
    group,
    footprints: positions.map(({ x, z }) => Array.from({ length: 10 }, (_, index) => {
      const angle = (index / 10) * Math.PI * 2;
      return [x + Math.cos(angle) * 3.2, z + Math.sin(angle) * 3.2] as [number, number];
    })),
  };
}

function createSimpleFountain(data: NonNullable<WashingtonParkData["fountain"]>) {
  const center = data.ring.reduce(
    (sum, [x, z]) => [sum[0] + x, sum[1] + z] as [number, number],
    [0, 0] as [number, number],
  ).map((value) => value / data.ring.length) as [number, number];
  const mappedRadius = data.ring.reduce(
    (sum, [x, z]) => sum + Math.hypot(x - center[0], z - center[1]),
    0,
  ) / data.ring.length;
  const radius = Math.max(4, mappedRadius);

  const limestone = new THREE.MeshStandardMaterial({ color: 0xc7b99f, roughness: 0.94 });
  const waterMaterial = new THREE.MeshStandardMaterial({
    color: 0x86aeb3,
    roughness: 0.32,
    metalness: 0.04,
  });
  const fountain = new THREE.Group();
  fountain.position.set(center[0], 0, center[1]);

  const base = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius * 1.03, 0.42, 48), limestone);
  base.position.y = 0.98;
  const water = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.78, radius * 0.78, 0.08, 48), waterMaterial);
  water.position.y = 1.23;
  const rim = new THREE.Mesh(new THREE.TorusGeometry(radius * 0.89, radius * 0.115, 8, 48), limestone);
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 1.34;
  const pedestal = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 0.09, radius * 0.13, 1.35, 12),
    limestone,
  );
  pedestal.position.y = 1.91;
  const bowl = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 0.25, radius * 0.18, 0.2, 20),
    limestone,
  );
  bowl.position.y = 2.64;

  const sprayMaterial = new THREE.MeshBasicMaterial({
    color: 0x73c9df,
    transparent: true,
    opacity: 0.94,
    depthWrite: true,
  });
  const sprays = new THREE.Group();
  const sprayCurves: THREE.QuadraticBezierCurve3[] = [];
  const sprayCount = 8;
  for (let index = 0; index < sprayCount; index += 1) {
    const angle = (index / sprayCount) * Math.PI * 2;
    const direction = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
    const start = direction.clone().multiplyScalar(radius * 0.08).setY(2.78);
    const end = direction.clone().multiplyScalar(radius * 0.64).setY(1.4);
    const apex = direction.clone().multiplyScalar(radius * 0.31).setY(7.1);
    const curve = new THREE.QuadraticBezierCurve3(start, apex, end);
    sprayCurves.push(curve);
    const jet = new THREE.Mesh(new THREE.TubeGeometry(curve, 18, 0.23, 6, false), sprayMaterial);
    jet.renderOrder = 4;
    sprays.add(jet);
  }
  const centerPlumeHeight = radius * 1.7;
  const centerJet = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 0.018, radius * 0.045, centerPlumeHeight, 10),
    sprayMaterial,
  );
  centerJet.position.y = 2.75 + centerPlumeHeight / 2;
  centerJet.renderOrder = 4;
  sprays.add(centerJet);

  const dropletsPerSpray = 5;
  const droplets = new THREE.InstancedMesh(
    new THREE.SphereGeometry(0.27, 6, 5),
    sprayMaterial,
    sprayCount * dropletsPerSpray,
  );
  droplets.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  droplets.renderOrder = 5;
  sprays.add(droplets);
  sprays.name = "Eight arcing fountain sprays and central plume";

  for (const part of [base, water, rim, pedestal, bowl]) {
    part.castShadow = part !== water;
    part.receiveShadow = true;
    fountain.add(part);
  }
  fountain.add(sprays);
  fountain.name = "Simple mapped Washington Square fountain";
  const dropletMatrix = new THREE.Matrix4();
  const dropletScale = new THREE.Vector3(1, 1, 1);
  const dropletRotation = new THREE.Quaternion();
  return {
    group: fountain,
    animation: {
      update: (elapsed: number) => {
        sprayCurves.forEach((curve, sprayIndex) => {
          for (let dropletIndex = 0; dropletIndex < dropletsPerSpray; dropletIndex += 1) {
            const progress = (elapsed * 0.72 + dropletIndex / dropletsPerSpray + sprayIndex * 0.037) % 1;
            const position = curve.getPoint(progress);
            dropletMatrix.compose(position, dropletRotation, dropletScale);
            droplets.setMatrixAt(sprayIndex * dropletsPerSpray + dropletIndex, dropletMatrix);
          }
        });
        droplets.instanceMatrix.needsUpdate = true;
        centerJet.scale.y = 0.88 + Math.sin(elapsed * 5.5) * 0.12;
      },
    } satisfies AmbientAnimation,
  };
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

async function loadGlb(url: string, signal: AbortSignal) {
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`${url} failed (${response.status})`);
  const buffer = await response.arrayBuffer();
  return new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(buffer, "");
}

async function loadBlenderArch(
  data: NonNullable<WashingtonParkData["arch"]>,
  signal: AbortSignal,
) {
  const startedAt = performance.now();
  const gltf = await loadGlb("/models/washington-square-arch.glb", signal);
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
    model.updateMatrixWorld(true);
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
  return normalized;
}

async function loadBobstLibrary(signal: AbortSignal) {
  const startedAt = performance.now();
  const gltf = await loadGlb("/models/bobst-library.glb", signal);
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
    // Start from the measured street-edge alignment, then apply the source
    // model's user-verified facade orientation.
    building.rotation.y = 0.998781 + (Math.PI * 3) / 2;
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
  return building;
}

function createCrosswalks(data: WashingtonParkData["crossings"], material: THREE.Material) {
  const crossings = new THREE.Group();
  const addCrosswalk = (x: number, z: number, angle: number, span: number) => {
    const crossing = new THREE.Group();
    const stripeSpacing = 1.05;
    const stripeCount = Math.max(5, Math.floor(span / stripeSpacing));
    for (let stripe = 0; stripe < stripeCount; stripe += 1) {
      const marking = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.035, 4.1), material);
      marking.position.x = (stripe - (stripeCount - 1) / 2) * stripeSpacing;
      marking.receiveShadow = true;
      marking.renderOrder = 3;
      crossing.add(marking);
    }
    crossing.position.set(x, 0.735, z);
    crossing.rotation.y = -angle;
    crossings.add(crossing);
  };

  for (const crossing of data) addCrosswalk(crossing.point[0], crossing.point[1], crossing.angle, crossing.span);

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
  buildingFootprints: Array<Array<[number, number]>>,
  planimetrics: WashingtonPlanimetricsData,
  fountain: WashingtonParkData["fountain"],
  parkObstacles: Array<Array<[number, number]>> = [],
): AmbientAnimation {
  const count = 300;
  const random = seededRandom(0x57a5_2026);
  const roadFootprints = planimetrics.roadbeds.map((roadbed) => roadbed.ring);
  const pedestrianObstacles = [...buildingFootprints, ...parkObstacles];
  if (fountain) {
    const center = fountain.ring.reduce(
      (sum, [x, z]) => [sum[0] + x, sum[1] + z] as [number, number],
      [0, 0] as [number, number],
    ).map((value) => value / fountain.ring.length) as [number, number];
    const radius = fountain.ring.reduce(
      (sum, [x, z]) => sum + Math.hypot(x - center[0], z - center[1]),
      0,
    ) / fountain.ring.length + 2.5;
    pedestrianObstacles.push(Array.from({ length: 24 }, (_, index) => {
      const angle = (index / 24) * Math.PI * 2;
      return [center[0] + Math.cos(angle) * radius, center[1] + Math.sin(angle) * radius] as [number, number];
    }));
  }
  const buildingIndex = createFootprintIndex(pedestrianObstacles);
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
  bodies.castShadow = false;
  heads.castShadow = false;
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
  buildingFootprints: Array<Array<[number, number]>>,
  planimetrics: WashingtonPlanimetricsData,
): AmbientAnimation {
  // The camera only exposes a portion of the road-data crop and tall buildings
  // occlude many vehicles. A larger simulated fleet keeps roughly 100 cars
  // readable in the overview instead of merely creating 100 mostly hidden ones.
  const count = 240;
  const random = seededRandom(0xca45_2026);
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
  const routeOrder = verifiedRoutes
    .map((route, routeIndex) => ({
      routeIndex,
      angle: Math.atan2(
        (route.start.y + route.end.y) / 2,
        (route.start.x + route.end.x) / 2,
      ),
      radius: route.start.clone().add(route.end).multiplyScalar(0.5).length(),
    }))
    .sort((a, b) => a.angle - b.angle || a.radius - b.radius);
  for (let index = 0; index < count; index += 1) {
    // Sample across the entire spatially ordered route list. There are normally
    // many more verified roadbeds than cars, so taking the first 100 would leave
    // a large directional wedge of the map without any traffic.
    const routeOrderIndex = Math.floor(index * routeOrder.length / count);
    const orderedRoute = routeOrder[routeOrderIndex];
    const route = verifiedRoutes[orderedRoute.routeIndex];
    const reversed = index % 2 === 1;
    cars.push({
      start: (reversed ? route.end : route.start).clone(),
      end: (reversed ? route.start : route.end).clone(),
      speed: 0.025 + random() * 0.025,
      offset: (index * 0.61803398875) % 1,
    });
  }

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
  const carColors = [0x45535f, 0xf1ede2, 0xf2b71d];
  cars.forEach((_, index) => {
    const color = new THREE.Color(index % 3 === 2 ? 0xf2b71d : carColors[index % 2]);
    chassis.setColorAt(index, color);
    cabins.setColorAt(index, color.clone().offsetHSL(0, -0.08, 0.08));
  });
  chassis.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  cabins.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  chassis.castShadow = false;
  cabins.castShadow = false;
  chassis.name = "240 road-verified low-detail cars with every third car a yellow taxi";
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
        // Ping-pong along each validated vector instead of teleporting from its
        // end back to its start. The direction changes only at an endpoint.
        const cycle = (car.offset + elapsed * car.speed) % 2;
        const returning = cycle > 1;
        const progress = returning ? 2 - cycle : cycle;
        const x = THREE.MathUtils.lerp(car.start.x, car.end.x, progress);
        const z = THREE.MathUtils.lerp(car.start.y, car.end.y, progress);
        const direction = returning ? -1 : 1;
        const heading = Math.atan2(
          -(car.end.y - car.start.y) * direction,
          (car.end.x - car.start.x) * direction,
        );
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

const INTERACTIVE_BUILDING_COLORS: Record<string, Record<SurfaceKind, number>> = {
  "1008875": { wall: 0x956553, roof: 0xb8aa9b, ground: 0x777872 },
  "1008627": { wall: 0x6f5d54, roof: 0x8d8176, ground: 0x63534c },
  "1077346": { wall: 0x8f5e50, roof: 0xaaa094, ground: 0x785047 },
  "1078952": { wall: 0xa9aaa5, roof: 0xc4c0b6, ground: 0x96958f },
};

function createInteractiveBuildingGroup(
  details: WashingtonCityRuntimeData["details"],
  ids: string[],
  name: string,
) {
  const group = new THREE.Group();
  for (const id of ids) {
    const surfaces = details[id];
    if (!surfaces) continue;
    const coloredSurfaces = surfaces.map((surface) => ({
      ...surface,
      color: new THREE.Color(INTERACTIVE_BUILDING_COLORS[id][surface.kind]),
    }));
    const mesh = new THREE.Mesh(
      makeSurfaceGeometry(coloredSurfaces),
      new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, side: THREE.FrontSide }),
    );
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.name = `${id} interactive city building`;
    group.add(mesh);
  }
  group.name = name;
  return group;
}

function bakeLandmarkAsSingleMesh(source: THREE.Object3D, name: string) {
  source.updateMatrixWorld(true);
  const geometries: THREE.BufferGeometry[] = [];
  source.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    const appendGeometry = (matrix: THREE.Matrix4) => {
      const geometry = object.geometry.clone();
      geometry.applyMatrix4(matrix);
      for (const attributeName of Object.keys(geometry.attributes)) {
        if (!["position", "normal", "color"].includes(attributeName)) geometry.deleteAttribute(attributeName);
      }
      if (!geometry.getAttribute("normal")) geometry.computeVertexNormals();
      if (!geometry.getAttribute("color")) {
        const material = Array.isArray(object.material) ? object.material[0] : object.material;
        const color = material instanceof THREE.MeshStandardMaterial ? material.color : new THREE.Color(0xffffff);
        const colors = new Float32Array(geometry.getAttribute("position").count * 3);
        for (let index = 0; index < colors.length; index += 3) {
          colors[index] = color.r; colors[index + 1] = color.g; colors[index + 2] = color.b;
        }
        geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
      }
      geometries.push(geometry);
    };
    if (object instanceof THREE.InstancedMesh) {
      const instanceMatrix = new THREE.Matrix4();
      for (let index = 0; index < object.count; index += 1) {
        object.getMatrixAt(index, instanceMatrix);
        appendGeometry(object.matrixWorld.clone().multiply(instanceMatrix));
      }
    } else {
      appendGeometry(object.matrixWorld);
    }
  });
  const geometry = mergeGeometries(geometries, false);
  geometries.forEach((item) => item.dispose());
  if (!geometry) throw new Error(`Unable to merge ${name}`);
  const mesh = new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.88, side: THREE.DoubleSide }),
  );
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.name = name;
  return mesh;
}

function createLandmarkDetails(details: WashingtonCityRuntimeData["details"]) {
  const groups = new Map<string, THREE.Group>();
  const styles: Record<string, { window: number; frame: number; spacing: number }> = {
    "1008875": { window: 0x667477, frame: 0x806056, spacing: 3.15 },
    "1008627": { window: 0x263238, frame: 0x8b7569, spacing: 3.45 },
    "1077346": { window: 0x4e5b5e, frame: 0xa56d5c, spacing: 3.2 },
    "1078952": { window: 0x58666a, frame: 0xc3c0b8, spacing: 3.3 },
  };
  for (const [id, surfaces] of Object.entries(details)) {
    const style = styles[id];
    if (!style) continue;
    const detailGroup = new THREE.Group();
    detailGroup.name = `${id} facade and rooftop details`;
    groups.set(id, detailGroup);
    const buildingPoints = surfaces.flatMap((surface) => surface.ring);
  const buildingCenter = buildingPoints.reduce(
    (sum, [x, , z]) => sum.add(new THREE.Vector2(x, z)),
    new THREE.Vector2(),
  ).multiplyScalar(1 / buildingPoints.length);
  const placements: Array<{ position: THREE.Vector3; rotation: THREE.Quaternion }> = [];
  const up = new THREE.Vector3(0, 1, 0);

    for (const surface of surfaces.filter((candidate) => candidate.kind === "wall")) {
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
    const columns = Math.max(1, Math.floor(facadeWidth / style.spacing));
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
      new THREE.MeshStandardMaterial({ color: style.window, roughness: 0.55, metalness: 0.06 }),
    placements.length,
  );
  const matrix = new THREE.Matrix4();
  const scale = new THREE.Vector3(1, 1, 1);
  placements.forEach((placement, index) => {
    matrix.compose(placement.position, placement.rotation, scale);
    windows.setMatrixAt(index, matrix);
  });
    windows.castShadow = false;
    windows.name = `${id} Bobst-style facade windows`;
    detailGroup.add(windows);

    const roofSurfaces = surfaces
      .filter((surface) => surface.kind === "roof" && Math.abs(surfaceNormal(surface.ring).y) > 0.72)
      .map((surface) => {
        const area = Math.abs(surface.ring.reduce((sum, point, index) => {
          const next = surface.ring[(index + 1) % surface.ring.length];
          return sum + point[0] * next[2] - next[0] * point[2];
        }, 0)) / 2;
        return { surface, area };
      })
      .filter((roof) => roof.area > 24)
      .sort((a, b) => b.area - a.area)
      .slice(0, 4);
    if (roofSurfaces.length) {
      const equipment = new THREE.Group();
      const equipmentMaterial = new THREE.MeshStandardMaterial({ color: style.frame, roughness: 0.92 });
      const sternVentMaterial = new THREE.MeshStandardMaterial({ color: 0x858783, roughness: 0.94 });
      const sternFanMaterial = new THREE.MeshStandardMaterial({ color: 0x151716, roughness: 0.82 });
      const layouts: Record<string, Array<[number, number]>> = {
        "1008627": [[0.12, 0.2], [0.27, 0.2], [0.42, 0.2], [0.57, 0.2], [0.72, 0.2], [0.87, 0.2]],
        "1008629": [[0.18, 0.24], [0.34, 0.24], [0.66, 0.24], [0.82, 0.24], [0.3, 0.7], [0.7, 0.7]],
        "1077346": [[0.16, 0.3], [0.39, 0.3], [0.62, 0.3], [0.85, 0.3]],
        "1078952": [[0.16, 0.22], [0.33, 0.22], [0.5, 0.22], [0.67, 0.22], [0.84, 0.22], [0.3, 0.7], [0.7, 0.7]],
        "1008875": [[0.2, 0.25], [0.5, 0.25], [0.8, 0.25]],
      };
      const layout = layouts[id];
      for (const [roofIndex, roof] of roofSurfaces.entries()) {
        if (id === "1077346" && roofIndex > 0) continue;
        const placements = roofIndex === 0 ? layout : layout.slice(0, Math.min(2, layout.length));
        const roofY = roof.surface.ring.reduce((sum, point) => sum + point[1], 0) / roof.surface.ring.length;
        let longestEdge = new THREE.Vector2(1, 0);
        let longestEdgeLength = 0;
        for (let edgeIndex = 0; edgeIndex < roof.surface.ring.length; edgeIndex += 1) {
          const start = roof.surface.ring[edgeIndex];
          const end = roof.surface.ring[(edgeIndex + 1) % roof.surface.ring.length];
          const edge = new THREE.Vector2(end[0] - start[0], end[2] - start[2]);
          if (edge.lengthSq() > longestEdgeLength) {
            longestEdgeLength = edge.lengthSq();
            longestEdge = edge.normalize();
          }
        }
        const perpendicular = new THREE.Vector2(-longestEdge.y, longestEdge.x);
        const roofPoints2d = roof.surface.ring.map((point) => new THREE.Vector2(point[0], point[2]));
        const along = roofPoints2d.map((point) => point.dot(longestEdge));
        const across = roofPoints2d.map((point) => point.dot(perpendicular));
        const alongMin = Math.min(...along); const alongMax = Math.max(...along);
        const acrossMin = Math.min(...across); const acrossMax = Math.max(...across);
        for (const [u, v] of placements) {
          const point = longestEdge.clone().multiplyScalar(THREE.MathUtils.lerp(alongMin, alongMax, u))
            .addScaledVector(perpendicular, THREE.MathUtils.lerp(acrossMin, acrossMax, v));
          const x = point.x;
          const z = point.y;
          const roofRing = roof.surface.ring.map((point) => [point[0], point[2]] as [number, number]);
          if (!pointInRing(x, z, roofRing)) continue;
          const width = id === "1077346" ? 10 : id === "1008627" ? 3.8 : 4.6;
          const height = id === "1077346" ? 3.1 : id === "1008627" ? 1.2 : 1.65;
          const depth = id === "1077346" ? 10 : id === "1008627" ? 3 : 3.6;
          const verticalOffset = id === "1077346" ? 0.75 : 0.04;
          const box = new THREE.Mesh(
            new THREE.BoxGeometry(width, height, depth),
            id === "1077346" ? sternVentMaterial : equipmentMaterial,
          );
          box.position.set(x, roofY + height / 2 + verticalOffset, z);
          box.rotation.y = -Math.atan2(longestEdge.y, longestEdge.x);
          box.castShadow = true;
          equipment.add(box);
          if (id === "1077346") {
            const fan = new THREE.Mesh(
              new THREE.BoxGeometry(6.6, 0.72, 6.6),
              sternFanMaterial,
            );
            fan.position.set(x, roofY + height + verticalOffset + 0.36, z);
            fan.rotation.y = box.rotation.y;
            fan.castShadow = true;
            equipment.add(fan);
          }
        }
      }
      equipment.name = `${id} simplified rooftop equipment`;
      detailGroup.add(equipment);
    }
  }
  return groups;
}

function createSternRotundaDetails() {
  const group = new THREE.Group();
  const center = new THREE.Vector2(85.5, 192.5);
  const radius = 9.92;
  const glass = new THREE.MeshStandardMaterial({ color: 0x7699a8, roughness: 0.32, metalness: 0.08 });
  const panelGeometry = new THREE.BoxGeometry(0.66, 7.6, 0.24);
  for (let index = 0; index < 24; index += 1) {
    const angle = THREE.MathUtils.lerp(-0.88, 2.03, index / 23);
    const panel = new THREE.Mesh(panelGeometry, glass);
    panel.position.set(center.x + Math.cos(angle) * radius, 16.2, center.y + Math.sin(angle) * radius);
    panel.rotation.y = -angle;
    panel.castShadow = false;
    group.add(panel);
  }
  const flagSettings = [{ angle: -0.45, color: 0x55258a }];
  for (const setting of flagSettings) {
    const poleStart = new THREE.Vector3(center.x + Math.cos(setting.angle) * 9.7, 17.2, center.y + Math.sin(setting.angle) * 9.7);
    const poleEnd = new THREE.Vector3(center.x + Math.cos(setting.angle) * 13.2, 20.1, center.y + Math.sin(setting.angle) * 13.2);
    const poleDirection = poleEnd.clone().sub(poleStart);
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.09, 0.09, poleDirection.length(), 6),
      new THREE.MeshStandardMaterial({ color: 0xaaa49b, roughness: 0.65, metalness: 0.25 }),
    );
    pole.position.copy(poleStart).add(poleEnd).multiplyScalar(0.5);
    pole.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), poleDirection.normalize());
    group.add(pole);
    const flagHeight = 5.2;
    const flag = new THREE.Mesh(
      new THREE.BoxGeometry(2.6, flagHeight, 0.16),
      new THREE.MeshStandardMaterial({ color: setting.color, roughness: 0.82, side: THREE.DoubleSide }),
    );
    flag.position.copy(poleEnd).add(new THREE.Vector3(0, -flagHeight / 2, 0));
    flag.rotation.y = -setting.angle - Math.PI / 2;
    group.add(flag);
  }
  group.name = "Stern rotunda glass band and NYU flag";
  return group;
}

function createGouldPlaza(scene: THREE.Scene) {
  const plaza = new THREE.Group();
  const plazaCenter = new THREE.Vector2(112.5, 191.3);
  plaza.position.set(plazaCenter.x, 0, plazaCenter.y);
  plaza.rotation.y = -0.57;
  const paving = new THREE.Mesh(
    new THREE.BoxGeometry(26, 0.12, 18),
    new THREE.MeshStandardMaterial({ color: 0xc6c0b3, roughness: 1 }),
  );
  paving.position.set(0, 0.79, 0);
  paving.receiveShadow = true;
  plaza.add(paving);

  const treePositions: Array<[number, number]> = [[101, 187], [106, 197], [113, 186], [120, 197], [125, 188]];
  const trunks = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.42, 0.58, 5.5, 6),
    new THREE.MeshStandardMaterial({ color: 0x75604a, roughness: 1 }),
    treePositions.length,
  );
  const crowns = new THREE.InstancedMesh(
    new THREE.IcosahedronGeometry(3.2, 1),
    new THREE.MeshStandardMaterial({ color: 0x788878, roughness: 1 }),
    treePositions.length,
  );
  const matrix = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion();
  treePositions.forEach(([x, z], index) => {
    const localX = x - plazaCenter.x;
    const localZ = z - plazaCenter.y;
    matrix.compose(new THREE.Vector3(localX, 3.55, localZ), quaternion, new THREE.Vector3(1, 1, 1));
    trunks.setMatrixAt(index, matrix);
    matrix.compose(new THREE.Vector3(localX, 7.25, localZ), quaternion, new THREE.Vector3(1 + (index % 2) * 0.18, 0.9, 1.08));
    crowns.setMatrixAt(index, matrix);
  });
  trunks.castShadow = true;
  crowns.castShadow = true;
  plaza.add(trunks, crowns);

  const seatPositions: Array<[number, number, number]> = [
    [102, 192, 0], [106, 188, Math.PI / 2], [111, 195, 0], [116, 188, Math.PI / 2], [121, 193, 0],
    [105, 198, 0], [114, 197, Math.PI / 2], [120, 188, 0], [124, 196, Math.PI / 2],
  ];
  const seats = new THREE.InstancedMesh(
    new THREE.BoxGeometry(3.6, 0.45, 1.35),
    new THREE.MeshStandardMaterial({ color: 0x4f5960, roughness: 0.85 }),
    seatPositions.length,
  );
  seatPositions.forEach(([x, z, yaw], index) => {
    matrix.compose(
      new THREE.Vector3(x - plazaCenter.x, 1.35, z - plazaCenter.y),
      quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw),
      new THREE.Vector3(1, 1, 1),
    );
    seats.setMatrixAt(index, matrix);
  });
  plaza.add(seats);
  plaza.name = "Detailed Gould Plaza paving trees and seating";
  scene.add(plaza);
  return plaza;
}

function createCourantGarden(scene: THREE.Scene) {
  const garden = new THREE.Group();
  const bed = new THREE.Mesh(
    new THREE.BoxGeometry(12.5, 0.24, 29),
    new THREE.MeshStandardMaterial({ color: 0x6f765e, roughness: 1 }),
  );
  bed.position.set(166, 0.86, 236);
  bed.rotation.y = -0.54;
  bed.receiveShadow = true;
  garden.add(bed);

  const treePositions: Array<[number, number, number]> = [
    [166, 221.5, 0.95], [171, 226, 1.12], [164, 230.5, 1.02], [170, 234.5, 1.18],
    [162, 239, 0.96], [168, 243, 1.08], [160, 247.5, 0.9],
  ];
  const trunks = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.5, 0.72, 6.8, 7),
    new THREE.MeshStandardMaterial({ color: 0x66513d, roughness: 1 }),
    treePositions.length,
  );
  const crowns = new THREE.InstancedMesh(
    new THREE.IcosahedronGeometry(4.1, 1),
    new THREE.MeshStandardMaterial({ color: 0x596b55, roughness: 1 }),
    treePositions.length,
  );
  const matrix = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion();
  treePositions.forEach(([x, z, scale], index) => {
    matrix.compose(new THREE.Vector3(x, 4.35, z), quaternion, new THREE.Vector3(scale, 1, scale));
    trunks.setMatrixAt(index, matrix);
    matrix.compose(
      new THREE.Vector3(x, 9 + (index % 3) * 0.45, z),
      quaternion,
      new THREE.Vector3(scale * (1 + (index % 2) * 0.12), scale * 1.05, scale),
    );
    crowns.setMatrixAt(index, matrix);
  });
  trunks.castShadow = true;
  crowns.castShadow = true;
  garden.add(trunks, crowns);
  garden.name = "Courant Mercer Street garden and mature trees";
  scene.add(garden);
  return garden;
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
    const abortController = new AbortController();

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xe8e4d9);
    scene.fog = new THREE.Fog(0xe8e4d9, 920, 1700);

    const camera = new THREE.OrthographicCamera(-500, 500, 390, -390, 10, 3500);
    const overviewCameraTarget = PARK_CENTER.clone().add(new THREE.Vector3(0, 28, 0));
    const cameraTarget = overviewCameraTarget.clone();
    const desiredCameraTarget = cameraTarget.clone();
    let cameraHeight = 560;
    let cameraRadius = 630;
    let cameraAzimuth = 0;
    let desiredCameraHeight = cameraHeight;
    let desiredCameraRadius = cameraRadius;
    let desiredCameraAzimuth = cameraAzimuth;
    let desiredCameraZoom = 1;
    let cameraLocked = false;
    let cameraTransitioning = false;
    let blockedZoomStartedAt = 0;
    const blockedZoomOrigin = cameraTarget.clone();
    const blockedZoomFocus = cameraTarget.clone();
    let blockedZoomGestureActive = false;
    let blockedZoomGestureReleaseTimer: number | undefined;
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
    const maximumPixelRatio = navigator.hardwareConcurrency <= 4 ? 1 : 1.25;
    let activePixelRatio = Math.min(window.devicePixelRatio, maximumPixelRatio);
    renderer.setPixelRatio(activePixelRatio);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.94;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    // The shadow casters are static apart from the short landmark hover lift.
    // Avoid redrawing the full city shadow map on every ambient animation frame.
    renderer.shadowMap.autoUpdate = false;
    renderer.shadowMap.needsUpdate = true;
    renderer.domElement.className = "washington-canvas is-loading";
    mount.appendChild(renderer.domElement);
    logLoad("Renderer ready", {
      pixelRatio: renderer.getPixelRatio(),
      viewport: `${mount.clientWidth}x${mount.clientHeight}`,
    });

    scene.add(new THREE.HemisphereLight(0xfff4dc, 0x87908c, 1.9));
    const sun = new THREE.DirectionalLight(0xffdca8, 1.4);
    sun.position.copy(PARK_CENTER).add(new THREE.Vector3(-720, 1080, 460));
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = -560;
    sun.shadow.camera.right = 560;
    sun.shadow.camera.top = 560;
    sun.shadow.camera.bottom = -560;
    sun.shadow.bias = -0.00015;
    sun.shadow.radius = 6;
    scene.add(sun);
    const skyTravelers = createSkyTravelers(scene);
    const ambientAnimations: AmbientAnimation[] = [];
    const clickableLandmarks: ClickableLandmark[] = [];
    const landmarkByRoot = new Map<THREE.Object3D, ClickableLandmark>();
    const raycastRoots: THREE.Object3D[] = [];
    const registerClickableLandmark = (root: THREE.Object3D) => {
      const glow = createBuildingGlow(root);
      root.add(glow);
      scene.add(root);
      const landmark = { root, glow, baseY: root.position.y, hovered: false, selected: false };
      clickableLandmarks.push(landmark);
      landmarkByRoot.set(root, landmark);
      raycastRoots.push(root);
      renderer.shadowMap.needsUpdate = true;
    };
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
    void (async () => {
      try {
        const requests = [
          fetch("/models/washington-city/manifest.json", { signal: abortController.signal }),
          fetch("/models/washington-city/runtime.json", { signal: abortController.signal }),
          fetch("/data/washington-square-planimetrics.json", { signal: abortController.signal }),
          fetch("/data/washington-square-park.json", { signal: abortController.signal }),
        ];
        const [manifestResponse, runtimeResponse, planimetricsResponse, parkResponse] = await Promise.all(requests);
        for (const response of [manifestResponse, runtimeResponse, planimetricsResponse, parkResponse]) {
          if (!response.ok) throw new Error(`${response.url} failed (${response.status})`);
        }
        const [manifest, runtime, planimetrics, park] = await Promise.all([
          manifestResponse.json() as Promise<WashingtonCityManifest>,
          runtimeResponse.json() as Promise<WashingtonCityRuntimeData>,
          planimetricsResponse.json() as Promise<WashingtonPlanimetricsData>,
          parkResponse.json() as Promise<WashingtonParkData>,
        ]);
        if (disposed) return;
        logLoad("Runtime data parsed", {
          buildings: manifest.buildingCount,
          footprints: runtime.footprints.length,
          tiles: manifest.tiles.length,
          roadbeds: planimetrics.roadbeds.length,
        });
        // Begin the nearest city-tile downloads before the synchronous route and
        // landmark construction below. Network/decode work can overlap that CPU
        // phase instead of sitting behind it in the startup waterfall.
        const orderedTiles = [...manifest.tiles].sort((a, b) => Math.hypot(a.x, a.z) - Math.hypot(b.x, b.z));
        let loadedTiles = 0;
        const loadTile = async (tile: WashingtonCityManifest["tiles"][number]) => {
          const gltf = await loadGlb(`/models/washington-city/${tile.file}?v=${manifest.version}`, abortController.signal);
          if (disposed) return;
          gltf.scene.traverse((object) => {
            if (!(object instanceof THREE.Mesh)) return;
            object.receiveShadow = true;
            object.castShadow = Math.hypot(tile.x, tile.z) < 330 && object.name === "wall";
            object.frustumCulled = true;
          });
          scene.add(gltf.scene);
          renderer.shadowMap.needsUpdate = true;
          loadedTiles += 1;
        };
        const cityTilesReady = (async () => {
          for (let index = 0; index < orderedTiles.length; index += 6) {
            await Promise.all(orderedTiles.slice(index, index + 6).map(loadTile));
            if (disposed) return;
            if (index === 0) {
              setStatus("");
              requestAnimationFrame(() => renderer.domElement.classList.replace("is-loading", "is-ready"));
              logLoad("First city tiles ready", { loadedTiles });
            }
            await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
          }
          logLoad("All city tiles ready", {
            loadedTiles,
            calls: renderer.info.render.calls,
            triangles: renderer.info.render.triangles,
            geometries: renderer.info.memory.geometries,
          });
        })();
        const parkTrees = createWashingtonSquareTrees(park);
        scene.add(parkTrees.group);
        ambientAnimations.push(
          createPedestrians(scene, runtime.footprints, planimetrics, park.fountain, parkTrees.footprints),
          createTraffic(scene, runtime.footprints, planimetrics),
        );
        const landmarkDetails = createLandmarkDetails(runtime.details);
        const liptonSource = createInteractiveBuildingGroup(runtime.details, ["1008875"], "Lipton Hall source geometry");
        const courantSource = createInteractiveBuildingGroup(runtime.details, ["1008627"], "Courant source geometry");
        const sternSource = createInteractiveBuildingGroup(runtime.details, ["1078952", "1077346"], "Stern source geometry");
        const liptonDetails = landmarkDetails.get("1008875");
        if (liptonDetails) liptonSource.add(liptonDetails);
        const courantDetails = landmarkDetails.get("1008627");
        if (courantDetails) courantSource.add(courantDetails);
        for (const id of ["1078952", "1077346"]) {
          const details = landmarkDetails.get(id);
          if (details) sternSource.add(details);
        }
        sternSource.add(createSternRotundaDetails());
        const lipton = bakeLandmarkAsSingleMesh(liptonSource, "Clickable merged Lipton Hall");
        const courant = bakeLandmarkAsSingleMesh(courantSource, "Clickable merged Courant Institute");
        const stern = bakeLandmarkAsSingleMesh(sternSource, "Clickable merged Stern building pair");
        registerClickableLandmark(lipton);
        registerClickableLandmark(courant);
        registerClickableLandmark(stern);
        createGouldPlaza(scene);
        createCourantGarden(scene);
        for (const [id, details] of landmarkDetails) {
          if (!["1008875", "1008627", "1077346", "1078952"].includes(id)) scene.add(details);
        }
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
          const fountain = createSimpleFountain(park.fountain);
          scene.add(fountain.group);
          ambientAnimations.push(fountain.animation);
        }
        if (park.arch) void loadBlenderArch(park.arch, abortController.signal)
          .then((arch) => { if (!disposed) scene.add(arch); })
          .catch((error) => {
            if (!disposed && error.name !== "AbortError") scene.add(createSimpleArch(park.arch!, new THREE.MeshStandardMaterial({ color: 0xf1ede4, roughness: 0.86 })));
          });
        void loadBobstLibrary(abortController.signal)
          .then((bobst) => {
            if (!disposed) {
              registerClickableLandmark(bobst);
            }
          })
          .catch((error) => { if (error.name !== "AbortError") console.warn(LOAD_LOG_PREFIX, "Bobst GLB failed", error); });

        await cityTilesReady;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        console.error(LOAD_LOG_PREFIX, "Scene load failed", error);
        setStatus(error instanceof Error ? error.message : "Scene load failed");
      }
    })();

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

    let isIntersecting = true;
    let animationRunning = false;
    const shouldAnimate = () => isIntersecting && document.visibilityState === "visible" && !disposed;
    const startAnimation = () => {
      if (animationRunning || !shouldAnimate()) return;
      animationRunning = true;
      timer.reset();
      frame = requestAnimationFrame(animate);
    };
    const intersectionObserver = new IntersectionObserver(([entry]) => {
      isIntersecting = entry.isIntersecting;
      if (shouldAnimate()) startAnimation();
      else {
        cancelAnimationFrame(frame);
        animationRunning = false;
      }
    }, { threshold: 0.01 });
    intersectionObserver.observe(mount);
    const handleVisibility = () => {
      if (shouldAnimate()) startAnimation();
      else {
        cancelAnimationFrame(frame);
        animationRunning = false;
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const pointerPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const pointerWorld = new THREE.Vector3();
    const updatePointerRay = (event: { clientX: number; clientY: number }) => {
      const bounds = renderer.domElement.getBoundingClientRect();
      pointer.set(
        ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
        -((event.clientY - bounds.top) / bounds.height) * 2 + 1,
      );
      raycaster.setFromCamera(pointer, camera);
    };
    const landmarkAtPointer = (event: { clientX: number; clientY: number }) => {
      updatePointerRay(event);
      const intersections = raycaster.intersectObjects(raycastRoots, true);
      for (const intersection of intersections) {
        let object: THREE.Object3D | null = intersection.object;
        while (object) {
          const landmark = landmarkByRoot.get(object);
          if (landmark) return landmark;
          object = object.parent;
        }
      }
      return null;
    };
    const selectLandmark = (landmark: ClickableLandmark) => {
      clickableLandmarks.forEach((candidate) => { candidate.selected = candidate === landmark; });
      landmark.root.updateWorldMatrix(true, true);
      const center = new THREE.Box3().setFromObject(landmark.root).getCenter(new THREE.Vector3());
      desiredCameraTarget.set(center.x, Math.max(18, center.y * 0.72), center.z);
      const isBobst = landmark.root.name.includes("Bobst");
      const isLipton = landmark.root.name.includes("Lipton");
      const isCourant = landmark.root.name.includes("Courant");
      const isStern = landmark.root.name.includes("Stern");
      if (isCourant) desiredCameraTarget.add(new THREE.Vector3(-10, 0, -24));
      desiredCameraAzimuth = isCourant
        ? 0
        : isStern ? Math.PI / 2 + 0.42
          : isBobst ? Math.PI - 0.42 : 0;
      desiredCameraHeight = isLipton ? 273 : isStern ? 252 : 210;
      desiredCameraRadius = isLipton ? 285 : 365;
      desiredCameraZoom = 2.41;
      cameraLocked = true;
      cameraTransitioning = true;
      blockedZoomStartedAt = 0;
    };
    const clearLandmarkSelection = () => {
      clickableLandmarks.forEach((landmark) => {
        landmark.selected = false;
        landmark.hovered = false;
      });
      desiredCameraTarget.copy(overviewCameraTarget);
      desiredCameraAzimuth = 0;
      desiredCameraHeight = 560;
      desiredCameraRadius = 630;
      desiredCameraZoom = 1;
      cameraLocked = false;
      cameraTransitioning = true;
      blockedZoomStartedAt = 0;
      renderer.domElement.style.cursor = "default";
    };

    let dragging = false;
    let pointerX = 0;
    let pointerDownX = 0;
    let pointerDownY = 0;
    let pointerMoved = false;
    const pointerDown = (event: PointerEvent) => {
      dragging = !cameraLocked;
      pointerX = event.clientX;
      pointerDownX = event.clientX;
      pointerDownY = event.clientY;
      pointerMoved = false;
      renderer.domElement.setPointerCapture(event.pointerId);
      if (dragging) renderer.domElement.classList.add("is-dragging");
    };
    const pointerMove = (event: PointerEvent) => {
      pointerMoved ||= Math.hypot(event.clientX - pointerDownX, event.clientY - pointerDownY) > 5;
      if (dragging) {
        cameraAzimuth -= (event.clientX - pointerX) * 0.005;
        desiredCameraAzimuth = cameraAzimuth;
        pointerX = event.clientX;
        updateCamera();
        return;
      }
      const hovered = landmarkAtPointer(event);
      clickableLandmarks.forEach((landmark) => { landmark.hovered = landmark === hovered; });
      renderer.domElement.style.cursor = hovered ? "pointer" : "default";
    };
    const pointerUp = (event: PointerEvent) => {
      if (!pointerMoved) {
        const landmark = landmarkAtPointer(event);
        if (landmark) selectLandmark(landmark);
      }
      dragging = false;
      if (renderer.domElement.hasPointerCapture(event.pointerId)) renderer.domElement.releasePointerCapture(event.pointerId);
      renderer.domElement.classList.remove("is-dragging");
    };
    renderer.domElement.addEventListener("pointerdown", pointerDown);
    renderer.domElement.addEventListener("pointermove", pointerMove);
    renderer.domElement.addEventListener("pointerup", pointerUp);
    renderer.domElement.addEventListener("pointercancel", pointerUp);
    const keyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && cameraLocked) clearLandmarkSelection();
    };
    const wheel = (event: WheelEvent) => {
      if (cameraLocked) {
        if (event.deltaY > 0) {
          event.preventDefault();
          clearLandmarkSelection();
        }
        return;
      }
      if (event.deltaY >= 0) return;
      event.preventDefault();
      const hovered = landmarkAtPointer(event);
      if (hovered) {
        selectLandmark(hovered);
        return;
      }
      const isFirstEventInGesture = !blockedZoomGestureActive;
      blockedZoomGestureActive = true;
      window.clearTimeout(blockedZoomGestureReleaseTimer);
      blockedZoomGestureReleaseTimer = window.setTimeout(() => {
        blockedZoomGestureActive = false;
      }, WHEEL_GESTURE_SETTLE_MS);
      if (isFirstEventInGesture) {
        updatePointerRay(event);
        blockedZoomOrigin.copy(cameraTarget);
        if (raycaster.ray.intersectPlane(pointerPlane, pointerWorld)) {
          blockedZoomFocus.copy(pointerWorld).setY(cameraTarget.y);
        } else {
          blockedZoomFocus.copy(cameraTarget);
        }
        blockedZoomStartedAt = performance.now();
      }
    };
    window.addEventListener("keydown", keyDown);
    renderer.domElement.addEventListener("wheel", wheel, { passive: false });

    let previousRender = 0;
    let renderSamples = 0;
    let renderCostTotal = 0;
    function animate(now = performance.now()) {
      if (!shouldAnimate()) {
        animationRunning = false;
        return;
      }
      frame = requestAnimationFrame(animate);
      if (!dragging && now - previousRender < 1000 / 30) return;
      previousRender = now;
      timer.update();
      const delta = Math.min(timer.getDelta(), 0.05);
      const elapsed = timer.getElapsed();
      const interactionEase = 1 - Math.exp(-delta * 9);
      const selectedLandmark = clickableLandmarks.find((landmark) => landmark.selected);
      for (const landmark of clickableLandmarks) {
        const lift = !landmark.selected && landmark.hovered ? 4.5 : 0;
        const previousY = landmark.root.position.y;
        landmark.root.position.y = THREE.MathUtils.lerp(
          landmark.root.position.y,
          landmark.baseY + lift,
          interactionEase,
        );
        if (Math.abs(landmark.root.position.y - previousY) > 0.001) renderer.shadowMap.needsUpdate = true;
        const glowMaterial = (landmark.glow.children[0] as THREE.Mesh | undefined)?.material;
        if (glowMaterial instanceof THREE.MeshBasicMaterial) {
          const enchantmentWave = 0.5 + Math.sin(elapsed * 3.4 + landmark.baseY * 0.17) * 0.5;
          const enchantmentHue = 0.56 + Math.sin(elapsed * 0.85 + landmark.baseY * 0.11) * 0.095;
          glowMaterial.color.setHSL(enchantmentHue, 0.72, 0.72);
          const glowSuppressed = selectedLandmark && selectedLandmark !== landmark;
          glowMaterial.opacity = THREE.MathUtils.lerp(
            glowMaterial.opacity,
            glowSuppressed
              ? 0
              : (landmark.hovered || landmark.selected ? 0.18 : 0.1) + enchantmentWave * 0.12,
            interactionEase,
          );
        }
      }
      if (cameraTransitioning) {
        cameraTarget.lerp(desiredCameraTarget, interactionEase);
        cameraAzimuth = THREE.MathUtils.lerp(cameraAzimuth, desiredCameraAzimuth, interactionEase);
        cameraHeight = THREE.MathUtils.lerp(cameraHeight, desiredCameraHeight, interactionEase);
        cameraRadius = THREE.MathUtils.lerp(cameraRadius, desiredCameraRadius, interactionEase);
        camera.zoom = THREE.MathUtils.lerp(camera.zoom, desiredCameraZoom, interactionEase);
        camera.updateProjectionMatrix();
        updateCamera();
        if (
          cameraTarget.distanceTo(desiredCameraTarget) < 0.05
          && Math.abs(cameraAzimuth - desiredCameraAzimuth) < 0.0005
          && Math.abs(cameraHeight - desiredCameraHeight) < 0.05
          && Math.abs(cameraRadius - desiredCameraRadius) < 0.05
          && Math.abs(camera.zoom - desiredCameraZoom) < 0.0005
        ) cameraTransitioning = false;
      }
      if (blockedZoomStartedAt) {
        const progress = Math.min(1, (now - blockedZoomStartedAt) / BLOCKED_ZOOM_DURATION_MS);
        const pulse = Math.sin(progress * Math.PI);
        camera.zoom = 1 + pulse * (BLOCKED_ZOOM_SCALE - 1);
        cameraTarget.copy(blockedZoomOrigin).lerp(blockedZoomFocus, pulse * 0.035);
        camera.updateProjectionMatrix();
        updateCamera();
        if (progress >= 1) {
          cameraTarget.copy(blockedZoomOrigin);
          updateCamera();
          blockedZoomStartedAt = 0;
        }
      }
      for (const traveler of skyTravelers) {
        const span = traveler.endX - traveler.startX;
        traveler.group.position.x = traveler.startX
          + ((traveler.group.position.x - traveler.startX + traveler.speed * delta + span) % span);
        traveler.group.position.y = traveler.baseY + Math.sin(elapsed * 0.55 + traveler.phase) * 3.5;
        traveler.flap?.(elapsed);
      }
      ambientAnimations.forEach((animation) => animation.update(elapsed));
      const renderStarted = performance.now();
      renderer.render(scene, camera);
      renderCostTotal += performance.now() - renderStarted;
      renderSamples += 1;
      if (renderSamples === 120) {
        const averageRenderMs = renderCostTotal / renderSamples;
        const targetPixelRatio = averageRenderMs > 18
          ? Math.max(0.75, activePixelRatio - 0.25)
          : averageRenderMs < 8 ? Math.min(maximumPixelRatio, activePixelRatio + 0.25) : activePixelRatio;
        if (targetPixelRatio !== activePixelRatio) {
          activePixelRatio = targetPixelRatio;
          renderer.setPixelRatio(activePixelRatio);
          resize();
          logLoad("Adaptive resolution changed", { pixelRatio: activePixelRatio, averageRenderMs: Math.round(averageRenderMs * 10) / 10 });
        }
        renderSamples = 0;
        renderCostTotal = 0;
      }
    }
    startAnimation();

    return () => {
      disposed = true;
      abortController.abort();
      cancelAnimationFrame(frame);
      window.clearTimeout(blockedZoomGestureReleaseTimer);
      observer.disconnect();
      intersectionObserver.disconnect();
      document.removeEventListener("visibilitychange", handleVisibility);
      renderer.domElement.removeEventListener("pointerdown", pointerDown);
      renderer.domElement.removeEventListener("pointermove", pointerMove);
      renderer.domElement.removeEventListener("pointerup", pointerUp);
      renderer.domElement.removeEventListener("pointercancel", pointerUp);
      window.removeEventListener("keydown", keyDown);
      renderer.domElement.removeEventListener("wheel", wheel);
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
