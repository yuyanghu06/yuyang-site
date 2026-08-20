"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { AMBIENT_LAYOUT } from "../generated/ambient-layout";
import { HUDSON_WATERFRONT } from "../generated/hudson-waterfront";

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
  parkRings?: Array<Array<[number, number]>>;
}

const SHARED_DATA_VERSION = "2026-08-20-manhattan-roads-2600-v1";

function isAbortError(error: unknown) {
  return typeof error === "object" && error !== null && "name" in error && error.name === "AbortError";
}

function createLoadLogger(prefix: string) {
  const startedAt = performance.now();
  const log = (stage: string, details: Record<string, unknown> = {}) => {
    console.info(prefix, stage, {
      elapsedMs: Math.round(performance.now() - startedAt),
      ...details,
    });
  };
  return Object.assign(log, {
    start(stage: string, details: Record<string, unknown> = {}) {
      const stageStartedAt = performance.now();
      log(`${stage} start`, details);
      return (endDetails: Record<string, unknown> = {}) => {
        log(`${stage} end`, {
          stageDurationMs: Math.round(performance.now() - stageStartedAt),
          ...endDetails,
        });
      };
    },
  });
}

interface SkyTraveler {
  group: THREE.Group;
  view: "manhattan" | "neighborhood";
  axis?: "x" | "z";
  speed: number;
  phase: number;
  startX: number;
  endX: number;
  baseY: number;
  bobAmount?: number;
  flap?: (elapsed: number) => void;
}

interface AmbientAnimation {
  update: (elapsed: number, now: number) => void;
}

const BLOCKED_ZOOM_DURATION_MS = 180;
const BLOCKED_ZOOM_SCALE = 1.035;
const BLOCKED_ZOOM_GESTURE_SETTLE_MS = 140;
const NAVIGATION_ARROW_Y = 130;
const NAVIGATION_ARROW_SCALE = 1.65;
const NAVIGATION_ARROW_SPRING_DURATION_MS = 1120;
const WASHINGTON_ARROW_POSITION = new THREE.Vector2(420, -175);
const UNION_ARROW_POSITION = new THREE.Vector2(125, -345);
const MANHATTAN_CENTER = new THREE.Vector3(220, 28, -400);
const WASHINGTON_CENTER = new THREE.Vector3(0, 28, 0);
const UNION_CENTER = new THREE.Vector3(545, 28, -580);
const MANHATTAN_TILE_RADIUS = 2600;
const NEIGHBORHOOD_TILE_RADIUS = 900;
const PARK_ZOOM_HIT_RADIUS = 165;
const MANHATTAN_CAMERA_HEIGHT = 1500;
// A 50° pitch away from a straight-down (nadir) view.
const MANHATTAN_CAMERA_RADIUS = (MANHATTAN_CAMERA_HEIGHT - MANHATTAN_CENTER.y) * Math.tan(THREE.MathUtils.degToRad(50));
const HUDSON_MIN_CITY_TILE_X = -1152;
const WORLD_UP = new THREE.Vector3(0, 1, 0);

type MapView = "manhattan" | "washington" | "union";

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

function createWorldNavigationArrow() {
  const shape = new THREE.Shape();
  shape.moveTo(-4, -14);
  shape.lineTo(4, -14);
  shape.lineTo(4, 4);
  shape.lineTo(10, 4);
  shape.lineTo(0, 16);
  shape.lineTo(-10, 4);
  shape.lineTo(-4, 4);
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: 4,
    bevelEnabled: true,
    bevelSize: 0.65,
    bevelThickness: 0.65,
    bevelSegments: 2,
  });
  geometry.rotateX(-Math.PI / 2);
  const material = new THREE.MeshStandardMaterial({
    color: 0xe2dfd6,
    emissive: 0xffffff,
    emissiveIntensity: 0.035,
    roughness: 0.68,
    metalness: 0,
    side: THREE.DoubleSide,
  });
  const arrow = new THREE.Mesh(geometry, material);
  arrow.castShadow = true;
  arrow.receiveShadow = true;
  arrow.renderOrder = 8;
  const shine = new THREE.Mesh(
    geometry,
    new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.07,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      toneMapped: false,
    }),
  );
  shine.scale.setScalar(1.045);
  shine.renderOrder = 7;
  shine.raycast = () => undefined;
  shine.name = "Navigation arrow white shine";
  const group = new THREE.Group();
  group.add(shine, arrow);
  group.position.set(WASHINGTON_ARROW_POSITION.x, NAVIGATION_ARROW_Y, WASHINGTON_ARROW_POSITION.y);
  group.rotation.y = -0.754;
  group.scale.setScalar(NAVIGATION_ARROW_SCALE);
  group.name = "World-space square navigation arrow";
  return group;
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

function createParkPaths(material: THREE.Material) {
  const segments = AMBIENT_LAYOUT.parkPaths;
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

function createParkTrees(
  positions: ReadonlyArray<{
    x: number; z: number; trunkScale: number; heightScale: number;
    crownScale: readonly [number, number, number]; crownColor: number;
  }>,
  label: string,
) {
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
  group.name = `${positions.length} boundary- and path-cleared ${label} trees`;
  return group;
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
    console.info("[WashingtonSquare load]", "Arch GLB ready", {
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
    console.info("[WashingtonSquare load]", "Bobst GLB ready", {
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

function createNeighborhoodBirdTravelers(scene: THREE.Scene) {
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

function createSkyTravelers(scene: THREE.Scene, overlayScene: THREE.Scene) {
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
    const cloud = new THREE.Group();
    for (const [lobeIndex, [x, y, z, radius]] of setting.lobes.entries()) {
      const variant = (cloudIndex + lobeIndex) % 3;
      const geometry = variant === 0
        ? new THREE.IcosahedronGeometry(radius, 2)
        : variant === 1
          ? new THREE.DodecahedronGeometry(radius, 1)
          : new THREE.OctahedronGeometry(radius, 2);
      const lobe = new THREE.Mesh(geometry, cloudMaterial);
      lobe.position.set(x, y, z);
      lobe.scale.set(1, 0.88 + ((cloudIndex + lobeIndex) % 3) * 0.08, 0.58 + (lobeIndex % 2) * 0.1);
      lobe.rotation.set(
        (cloudIndex * 0.17 + lobeIndex * 0.11) % 0.42,
        (cloudIndex * 0.31 + lobeIndex * 0.23) % 0.7,
        (cloudIndex * 0.09 - lobeIndex * 0.13) % 0.36,
      );
      lobe.renderOrder = 6;
      cloud.add(lobe);
    }
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

  const createPlane = (color: number) => {
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
    plane.name = "Manhattan overview airplane";
    return plane;
  };
  const planeSettings = [
    { x: -430, y: 940, z: 1150, speed: -48, phase: 0.8, scale: 1 },
    { x: 890, y: 760, z: -1650, speed: 39, phase: 3.7, scale: 0.82 },
  ];
  planeSettings.forEach((setting, index) => {
    const plane = createPlane(0xffffff);
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

function populationScale(now: number, revealAt: number, index: number, count: number) {
  const stagger = count > 1 ? ((index * 137) % count) / (count - 1) : 0;
  const progress = THREE.MathUtils.clamp((now - revealAt - stagger * 1500) / 420, 0, 1);
  return 1 - Math.pow(1 - progress, 3);
}

function createPedestrians(scene: THREE.Scene, isVisible: () => boolean, revealAt: () => number): AmbientAnimation {
  const walkers = AMBIENT_LAYOUT.pedestrians;

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
        const bob = Math.abs(Math.sin(elapsed * 5 + walker.phase)) * 0.16;
        quaternion.setFromAxisAngle(WORLD_UP, -angle + Math.PI / 2);
        scale.setScalar(arrival);
        bodyMatrix.compose(position.set(x, 2.15 + bob - (1 - arrival) * 3, z), quaternion, scale);
        headMatrix.compose(position.set(x, 4.02 + bob - (1 - arrival) * 3, z), quaternion, scale);
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
  revealAt: () => number,
): AmbientAnimation {
  // The camera only exposes a portion of the road-data crop and tall buildings
  // occlude many vehicles. A larger simulated fleet keeps roughly 100 cars
  // readable in the overview instead of merely creating 100 mostly hidden ones.
  const cars = AMBIENT_LAYOUT.traffic;
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
  chassis.name = `${count} road-verified low-detail cars with every third car a yellow taxi`;
  cabins.name = "Low-detail car cabins";
  scene.add(chassis, cabins);

  const chassisMatrix = new THREE.Matrix4();
  const cabinMatrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  const scale = new THREE.Vector3(1, 1, 1);
  return {
    update: (elapsed, now) => {
      cars.forEach((car, index) => {
        const arrival = populationScale(now, revealAt(), index, count);
        // Ping-pong along each validated vector instead of teleporting from its
        // end back to its start. The direction changes only at an endpoint.
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
        chassisMatrix.compose(position.set(x, 1.55 - (1 - arrival) * 2.5, z), quaternion, scale);
        cabinMatrix.compose(position.set(x, 2.62 - (1 - arrival) * 2.5, z), quaternion, scale);
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
  "1087304": { wall: 0xc49b72, roof: 0x94a184, ground: 0xa98568 },
  "1017906": { wall: 0xc7aa83, roof: 0x9b9384, ground: 0xa18d72 },
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
    "1087304": { window: 0x596568, frame: 0xb78e6d, spacing: 3.15 },
    "1017906": { window: 0x4f5b5e, frame: 0xb69a78, spacing: 3.05 },
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
      // Most interactive landmarks only need facade windows. Rooftop
      // equipment is intentionally limited to buildings with an explicit,
      // reviewed layout; an absent layout must not abort the entire scene.
      if (!layout) continue;
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

type HorizontalRing = readonly (readonly [number, number])[];

function createHorizontalShapeGeometry(outer: HorizontalRing, holes: readonly HorizontalRing[] = [], depth = 0) {
  const ring = outer.at(-1)?.[0] === outer[0]?.[0] && outer.at(-1)?.[1] === outer[0]?.[1]
    ? outer.slice(0, -1)
    : outer;
  const shape = new THREE.Shape(ring.map(([x, z]) => new THREE.Vector2(x, -z)));
  for (const sourceHole of holes) {
    const hole = sourceHole.at(-1)?.[0] === sourceHole[0]?.[0] && sourceHole.at(-1)?.[1] === sourceHole[0]?.[1]
      ? sourceHole.slice(0, -1)
      : sourceHole;
    shape.holes.push(new THREE.Path(hole.map(([x, z]) => new THREE.Vector2(x, -z))));
  }
  const geometry = depth > 0
    ? new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false })
    : new THREE.ShapeGeometry(shape);
  geometry.rotateX(-Math.PI / 2);
  return geometry;
}

function createRoadRibbonGeometry(points: HorizontalRing, width: number) {
  const positions: number[] = [];
  const indices: number[] = [];
  for (let index = 0; index < points.length; index += 1) {
    const previous = points[Math.max(0, index - 1)];
    const next = points[Math.min(points.length - 1, index + 1)];
    const dx = next[0] - previous[0];
    const dz = next[1] - previous[1];
    const length = Math.hypot(dx, dz) || 1;
    const offsetX = -dz / length * width * 0.5;
    const offsetZ = dx / length * width * 0.5;
    positions.push(points[index][0] + offsetX, 0, points[index][1] + offsetZ);
    positions.push(points[index][0] - offsetX, 0, points[index][1] - offsetZ);
    if (index === 0) continue;
    const base = index * 2;
    indices.push(base - 2, base, base - 1, base, base + 1, base - 1);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function createWaterMaterial() {
  return new THREE.MeshStandardMaterial({
    color: 0x354345,
    roughness: 0.76,
    metalness: 0.08,
  });
}

function createHudsonWaterAndPier() {
  const group = new THREE.Group();
  const shoreline = HUDSON_WATERFRONT.shoreline;
  const northZ = Math.min(...shoreline.map(([, z]) => z));
  const southZ = Math.max(...shoreline.map(([, z]) => z));
  const westX = -3100;
  const waterRing: Array<[number, number]> = [
    [westX, northZ],
    ...shoreline.map(([x, z]) => [x, z] as [number, number]),
    [westX, southZ],
  ];
  const water = new THREE.Mesh(
    createHorizontalShapeGeometry(waterRing),
    createWaterMaterial(),
  );
  water.position.y = 0.92;
  water.receiveShadow = true;
  water.name = "OpenStreetMap-shaped dark Hudson River surface";
  group.add(water);

  const pier = new THREE.Mesh(
    createHorizontalShapeGeometry(HUDSON_WATERFRONT.pier40.outer, [HUDSON_WATERFRONT.pier40.inner], 3.2),
    new THREE.MeshStandardMaterial({ color: 0xaaa18e, roughness: 0.92 }),
  );
  pier.position.y = 0.94;
  pier.castShadow = true;
  pier.receiveShadow = true;
  pier.name = "OpenStreetMap Pier 40 parking structure footprint";
  group.add(pier);

  const pierGreen = new THREE.Mesh(
    createHorizontalShapeGeometry(HUDSON_WATERFRONT.pier40.field),
    new THREE.MeshStandardMaterial({ color: 0x788878, roughness: 1 }),
  );
  pierGreen.position.y = 4.2;
  pierGreen.receiveShadow = true;
  pierGreen.name = "Mapped Pier 40 athletic field";
  group.add(pierGreen);

  const treePositions: Array<[number, number, number]> = [];
  // Sample by north/south distance instead of raw OSM vertex density. This
  // keeps the esplanade planting continuous and even through complex piers.
  const treeSpacing = 56;
  for (let z = northZ + treeSpacing * 0.5; z <= southZ - treeSpacing * 0.5; z += treeSpacing) {
    const nearby = shoreline.filter(([, pointZ]) => Math.abs(pointZ - z) <= treeSpacing * 0.75);
    const candidates = nearby.length > 0
      ? nearby
      : [shoreline.reduce((closest, point) => (
          Math.abs(point[1] - z) < Math.abs(closest[1] - z) ? point : closest
        ))];
    // The landward/easternmost candidate avoids planting out on pier arms.
    const x = Math.max(...candidates.map(([pointX]) => pointX)) + 10.5;
    const scale = 0.96 + (treePositions.length % 4) * 0.045;
    treePositions.push([x, z, scale]);
  }
  const trunks = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.56, 0.82, 7.2, 7),
    new THREE.MeshStandardMaterial({ color: 0x66513d, roughness: 1 }),
    treePositions.length,
  );
  const crowns = new THREE.InstancedMesh(
    new THREE.IcosahedronGeometry(4.45, 1),
    new THREE.MeshStandardMaterial({ color: 0x68785f, roughness: 1 }),
    treePositions.length,
  );
  const matrix = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion();
  treePositions.forEach(([x, z, scale], index) => {
    matrix.compose(new THREE.Vector3(x, 8.1, z), quaternion, new THREE.Vector3(scale, 1, scale));
    trunks.setMatrixAt(index, matrix);
    matrix.compose(
      new THREE.Vector3(x, 13.5 + (index % 3) * 0.28, z),
      quaternion,
      new THREE.Vector3(scale * 1.08, scale, scale),
    );
    crowns.setMatrixAt(index, matrix);
  });
  trunks.castShadow = true;
  crowns.castShadow = true;
  group.add(trunks, crowns);
  group.name = "OSM Hudson shoreline with tree-lined waterfront and simple Pier 40";
  return group;
}

function createEastRiverWaterAndPiers() {
  const group = new THREE.Group();
  const shoreline = HUDSON_WATERFRONT.eastRiver.shoreline;
  const northZ = Math.min(...shoreline.map(([, z]) => z));
  const southZ = Math.max(...shoreline.map(([, z]) => z));
  const eastX = 3200;
  const waterRing: Array<[number, number]> = [
    [eastX, northZ],
    ...shoreline.map(([x, z]) => [x, z] as [number, number]),
    [eastX, southZ],
  ];
  const water = new THREE.Mesh(
    createHorizontalShapeGeometry(waterRing),
    createWaterMaterial(),
  );
  water.position.y = 0.92;
  water.receiveShadow = true;
  water.name = "OpenStreetMap-shaped dark East River surface";
  group.add(water);

  const pierMaterial = new THREE.MeshStandardMaterial({ color: 0xaaa18e, roughness: 0.94 });
  const roadMaterial = new THREE.MeshStandardMaterial({ color: 0x625f58, roughness: 1 });
  const fdrRoadway = new THREE.Group();
  for (const way of HUDSON_WATERFRONT.eastRiver.fdrWays) {
    const roadway = new THREE.Mesh(createRoadRibbonGeometry(way.points, 8.5), roadMaterial);
    roadway.position.y = 0.82;
    roadway.receiveShadow = true;
    roadway.name = `Mapped FDR Drive carriageway ${way.sourceId}`;
    fdrRoadway.add(roadway);
  }
  fdrRoadway.name = "Complete mapped FDR Drive roadway";
  group.add(fdrRoadway);
  for (const pier of HUDSON_WATERFRONT.eastRiver.piers) {
    if (pier.area && pier.points.length >= 3) {
      const deck = new THREE.Mesh(createHorizontalShapeGeometry(pier.points, [], 1.8), pierMaterial);
      deck.position.y = 0.94;
      deck.castShadow = true;
      deck.receiveShadow = true;
      deck.name = `Mapped East River pier ${pier.sourceId}`;
      group.add(deck);
      const minX = Math.min(...pier.points.map(([x]) => x));
      const maxX = Math.max(...pier.points.map(([x]) => x));
      const centerZ = pier.points.reduce((sum, [, z]) => sum + z, 0) / pier.points.length;
      if (maxX - minX > 18) {
        const access = new THREE.Mesh(
          createRoadRibbonGeometry([[minX + 3, centerZ], [maxX - 3, centerZ]], 3.6),
          roadMaterial,
        );
        access.position.y = 2.82;
        access.name = `Simple East River pier access lane ${pier.sourceId}`;
        group.add(access);
      }
      continue;
    }
    for (let index = 1; index < pier.points.length; index += 1) {
      const [fromX, fromZ] = pier.points[index - 1];
      const [toX, toZ] = pier.points[index];
      const dx = toX - fromX;
      const dz = toZ - fromZ;
      const length = Math.hypot(dx, dz);
      if (length < 0.5) continue;
      const deck = new THREE.Mesh(new THREE.BoxGeometry(7, 1.8, length), pierMaterial);
      deck.position.set((fromX + toX) / 2, 1.84, (fromZ + toZ) / 2);
      deck.rotation.y = Math.atan2(dx, dz);
      deck.castShadow = true;
      deck.receiveShadow = true;
      deck.name = `Mapped East River pier arm ${pier.sourceId}`;
      group.add(deck);
    }
  }

  const treePositions: Array<[number, number, number]> = [];
  let distanceSinceTree = 0;
  for (let index = 1; index < shoreline.length; index += 1) {
    const [startX, startZ] = shoreline[index - 1];
    const [endX, endZ] = shoreline[index];
    const segmentLength = Math.hypot(endX - startX, endZ - startZ);
    if (segmentLength > 130) {
      distanceSinceTree = 0;
      continue;
    }
    let traversed = 0;
    while (distanceSinceTree + segmentLength - traversed >= 72) {
      traversed += 72 - distanceSinceTree;
      const ratio = traversed / segmentLength;
      treePositions.push([
        THREE.MathUtils.lerp(startX, endX, ratio) - 11,
        THREE.MathUtils.lerp(startZ, endZ, ratio),
        0.76 + (treePositions.length % 4) * 0.055,
      ]);
      distanceSinceTree = 0;
    }
    distanceSinceTree += segmentLength - traversed;
  }
  const trunks = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.48, 0.7, 6.2, 7),
    new THREE.MeshStandardMaterial({ color: 0x66513d, roughness: 1 }),
    treePositions.length,
  );
  const crowns = new THREE.InstancedMesh(
    new THREE.IcosahedronGeometry(3.7, 1),
    new THREE.MeshStandardMaterial({ color: 0x68785f, roughness: 1 }),
    treePositions.length,
  );
  const matrix = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion();
  treePositions.forEach(([x, z, scale], index) => {
    matrix.compose(new THREE.Vector3(x, 7.6, z), quaternion, new THREE.Vector3(scale, 1, scale));
    trunks.setMatrixAt(index, matrix);
    matrix.compose(
      new THREE.Vector3(x, 12.3 + (index % 3) * 0.35, z),
      quaternion,
      new THREE.Vector3(scale * 1.08, scale, scale),
    );
    crowns.setMatrixAt(index, matrix);
  });
  trunks.castShadow = true;
  crowns.castShadow = true;
  group.add(trunks, crowns);
  group.name = "OSM East River shoreline with FDR Drive, pier access, and waterfront trees";
  return group;
}

export default function Nyc3dMap() {
  const mountRef = useRef<HTMLDivElement>(null);
  const switchStudyRef = useRef<(next: MapView, updateUrl?: boolean) => void>(() => undefined);
  const [status, setStatus] = useState("");

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    let activeStudy: MapView = "manhattan";
    const isUnion = false;
    const studyName = isUnion ? "Union Square" : "Washington Square";
    const loadLogPrefix = `[${studyName.replaceAll(" ", "")} load]`;
    const logLoad = createLoadLogger(loadLogPrefix);
    const parkCenter = MANHATTAN_CENTER.clone().setY(0);
    let disposed = false;
    let frame = 0;
    const abortController = new AbortController();
    const visibilityWaiters = new Set<() => void>();
    const waitForVisible = () => {
      if (document.visibilityState === "visible") return Promise.resolve();
      return new Promise<void>((resolve) => visibilityWaiters.add(resolve));
    };
    const yieldToMainThread = () => new Promise<void>((resolve) => window.setTimeout(resolve, 0));

    const scene = new THREE.Scene();
    const skyOverlayScene = new THREE.Scene();
    skyOverlayScene.add(new THREE.HemisphereLight(0xffffff, 0xded8cc, 2.4));
    const skyOverlayKey = new THREE.DirectionalLight(0xffffff, 1.8);
    skyOverlayKey.position.set(-600, 1200, 500);
    skyOverlayScene.add(skyOverlayKey);
    // Water is the persistent frame-zero backdrop. The land datum springs over
    // it, so river areas never change color when the WebGL canvas takes over.
    scene.background = new THREE.Color(0x354345);
    scene.fog = null;

    const camera = new THREE.OrthographicCamera(-500, 500, 390, -390, 10, 3500);
    const overviewCameraTarget = MANHATTAN_CENTER.clone();
    const cameraTarget = overviewCameraTarget.clone();
    const desiredCameraTarget = cameraTarget.clone();
    let cameraHeight = MANHATTAN_CAMERA_HEIGHT;
    let cameraRadius = MANHATTAN_CAMERA_RADIUS;
    let cameraAzimuth = 0;
    let desiredCameraHeight = cameraHeight;
    let desiredCameraRadius = cameraRadius;
    let desiredCameraAzimuth = cameraAzimuth;
    let desiredCameraZoom = 0.3;
    camera.zoom = desiredCameraZoom;
    let cameraLocked = false;
    let cameraTransitioning = false;
    let blockedZoomStartedAt = 0;
    let blockedZoomGestureActive = false;
    let blockedZoomGestureReset = 0;
    let zoomOutGestureActive = false;
    let zoomOutGestureReset = 0;
    const blockedZoomOrigin = cameraTarget.clone();
    const blockedZoomFocus = cameraTarget.clone();
    let blockedZoomOriginZoom = camera.zoom;
    const updateCamera = () => {
      camera.position.set(
        cameraTarget.x + Math.sin(cameraAzimuth) * cameraRadius,
        cameraHeight,
        cameraTarget.z + Math.cos(cameraAzimuth) * cameraRadius,
      );
      camera.lookAt(cameraTarget);
    };
    updateCamera();
    let requestNeighborhood: ((center: THREE.Vector3, radius: number) => void) | null = null;
    let navigationArrow: THREE.Group | null = null;
    let navigationArrowSpringStartedAt = Number.POSITIVE_INFINITY;
    let navigationArrowSpringComplete = false;
    switchStudyRef.current = (next, updateUrl = true) => {
      activeStudy = next;
      const isManhattan = next === "manhattan";
      const nextCenter = next === "union"
        ? UNION_CENTER
        : next === "washington" ? WASHINGTON_CENTER : MANHATTAN_CENTER;
      clickableLandmarks.forEach((landmark) => {
        landmark.selected = false;
        landmark.hovered = false;
        landmark.glow.visible = !isManhattan;
      });
      desiredCameraTarget.copy(nextCenter);
      desiredCameraAzimuth = 0;
      desiredCameraHeight = isManhattan ? MANHATTAN_CAMERA_HEIGHT : 560;
      desiredCameraRadius = isManhattan ? MANHATTAN_CAMERA_RADIUS : 630;
      desiredCameraZoom = isManhattan ? 0.3 : 1;
      scene.fog = isManhattan ? null : new THREE.Fog(0xe8e4d9, 920, 1700);
      cameraLocked = false;
      cameraTransitioning = true;
      blockedZoomStartedAt = 0;
      if (navigationArrow) {
        navigationArrow.visible = !isManhattan;
        navigationArrow.position.x = next === "union" ? UNION_ARROW_POSITION.x : WASHINGTON_ARROW_POSITION.x;
        navigationArrow.position.z = next === "union" ? UNION_ARROW_POSITION.y : WASHINGTON_ARROW_POSITION.y;
        navigationArrow.rotation.y = next === "union" ? Math.PI - 0.754 : -0.754;
      }
      if (!isManhattan && !neighborhoodBirdsLoaded) {
        skyTravelers.push(...createNeighborhoodBirdTravelers(scene));
        neighborhoodBirdsLoaded = true;
      }
      requestNeighborhood?.(nextCenter, isManhattan ? MANHATTAN_TILE_RADIUS : NEIGHBORHOOD_TILE_RADIUS);
      if (updateUrl) window.history.pushState({ study: next }, "", "/");
    };
    const handlePopState = (event: PopStateEvent) => switchStudyRef.current(
      event.state?.study === "union" ? "union" : event.state?.study === "washington" ? "washington" : "manhattan",
      false,
    );
    window.addEventListener("popstate", handlePopState);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: "high-performance",
      stencil: true,
    });
    renderer.autoClear = false;
    const maximumPixelRatio = navigator.hardwareConcurrency <= 4 ? 1 : 1.25;
    let activePixelRatio = Math.min(window.devicePixelRatio, maximumPixelRatio);
    renderer.setPixelRatio(activePixelRatio);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.94;
    renderer.setClearColor(0x354345, 1);
    renderer.clear();
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    // The shadow casters are static apart from the short landmark hover lift.
    // Avoid redrawing the full city shadow map on every ambient animation frame.
    renderer.shadowMap.autoUpdate = false;
    renderer.shadowMap.needsUpdate = true;
    renderer.domElement.className = "washington-canvas is-ready";

    scene.add(new THREE.HemisphereLight(0xfff4dc, 0x87908c, 1.9));
    navigationArrow = createWorldNavigationArrow();
    if (isUnion) {
      navigationArrow.position.set(UNION_ARROW_POSITION.x, NAVIGATION_ARROW_Y, UNION_ARROW_POSITION.y);
      navigationArrow.rotation.y = Math.PI - 0.754;
    }
    navigationArrow.visible = false;
    navigationArrow.scale.setScalar(0.001);
    scene.add(navigationArrow);
    const sun = new THREE.DirectionalLight(0xffdca8, 1.4);
    sun.position.copy(parkCenter).add(new THREE.Vector3(-720, 1080, 460));
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = -560;
    sun.shadow.camera.right = 560;
    sun.shadow.camera.top = 560;
    sun.shadow.camera.bottom = -560;
    sun.shadow.bias = -0.00015;
    sun.shadow.radius = 6;
    scene.add(sun);
    let skyTravelers: SkyTraveler[] = [];
    let neighborhoodBirdsLoaded = false;
    const ambientAnimations: AmbientAnimation[] = [];
    const arrivingTiles: Array<{
      root: THREE.Object3D;
      materials: THREE.Material[];
      startedAt: number;
      distance: number;
      rise: number;
      fade: boolean;
      targetY?: number;
      durationMs?: number;
      freezeRoot?: boolean;
    }> = [];
    const queueSpringArrival = (
      root: THREE.Object3D,
      delay = 0,
      rise = 34,
      fade = false,
      durationMs?: number,
    ) => {
      const materials: THREE.Material[] = [];
      root.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) return;
        object.updateMatrix();
        object.matrixAutoUpdate = false;
        if (!fade) return;
        for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
          material.transparent = fade;
          material.opacity = fade ? 0 : 1;
          material.depthWrite = !fade;
          materials.push(material);
        }
      });
      const targetY = root.position.y;
      root.matrixAutoUpdate = true;
      root.position.y = targetY - rise;
      root.visible = false;
      arrivingTiles.push({
        root,
        materials,
        startedAt: performance.now() + delay,
        distance: 0,
        rise,
        fade,
        targetY,
        durationMs,
      });
    };
    const clickableLandmarks: ClickableLandmark[] = [];
    const landmarkByRoot = new Map<THREE.Object3D, ClickableLandmark>();
    const raycastRoots: THREE.Object3D[] = [];
    const registerClickableLandmark = (root: THREE.Object3D) => {
      const glow = createBuildingGlow(root);
      glow.visible = activeStudy !== "manhattan";
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
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(5200, 5200), sidewalkMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.position.copy(parkCenter).setY(0.68);
    ground.receiveShadow = true;
    scene.add(ground);
    const hudsonWaterAndPier = createHudsonWaterAndPier();
    const eastRiverWaterAndPiers = createEastRiverWaterAndPiers();
    scene.add(hudsonWaterAndPier, eastRiverWaterAndPiers);
    const hudsonWater = hudsonWaterAndPier.children.find((child) => child.name.includes("Hudson River surface"));
    const eastRiverWater = eastRiverWaterAndPiers.children.find((child) => child.name.includes("East River surface"));
    // Land is present on frame zero. Both complete water surfaces then fade in
    // together at their final elevation; no fill or vertical plane crossing.
    const waterArrivalDelayMs = 260;
    const waterArrivalDurationMs = 260;
    const waterArrivalCompleteAt = performance.now() + waterArrivalDelayMs + waterArrivalDurationMs;
    if (hudsonWater) queueSpringArrival(hudsonWater, waterArrivalDelayMs, 0, true, waterArrivalDurationMs);
    if (eastRiverWater) queueSpringArrival(eastRiverWater, waterArrivalDelayMs, 0, true, waterArrivalDurationMs);
    const waterfrontArrivalDelayMs = waterArrivalDelayMs + waterArrivalDurationMs + 80;
    hudsonWaterAndPier.children
      .filter((child) => child !== hudsonWater)
      .forEach((child, index) => queueSpringArrival(child, waterfrontArrivalDelayMs + index * 35, 22));
    eastRiverWaterAndPiers.children
      .filter((child) => child !== eastRiverWater)
      .forEach((child, index) => queueSpringArrival(child, waterfrontArrivalDelayMs + 60 + index * 24, 22));

    const roadVisualReady = loadGlb(`/models/manhattan-roads.glb?v=${SHARED_DATA_VERSION}`, abortController.signal)
      .then((gltf) => {
        if (disposed) return performance.now();
        const roadMaterial = new THREE.MeshStandardMaterial({
          color: 0x6f6a61,
          roughness: 1,
          side: THREE.DoubleSide,
          stencilWrite: true,
          stencilRef: 1,
          stencilFunc: THREE.AlwaysStencilFunc,
          stencilZPass: THREE.ReplaceStencilOp,
        });
        gltf.scene.traverse((object) => {
          if (!(object instanceof THREE.Mesh)) return;
          object.material = roadMaterial;
          object.receiveShadow = true;
          object.renderOrder = -1;
        });
        gltf.scene.position.y = -34;
        gltf.scene.visible = false;
        gltf.scene.name = "Precompiled NYC 2022 planimetric roadbeds";
        scene.add(gltf.scene);
        const surfaceRevealAt = Math.max(performance.now() + 420, waterArrivalCompleteAt + 80);
        arrivingTiles.push({ root: gltf.scene, materials: [roadMaterial], startedAt: surfaceRevealAt + 100, distance: 0, rise: 34, fade: false });
        return surfaceRevealAt + 100;
      })
      .catch((error) => {
        if (isAbortError(error)) return performance.now();
        throw error;
      });

    logLoad("Data requests started");
    void (async () => {
      try {
        const manifestRequest = fetch("/models/washington-city/manifest.json", { signal: abortController.signal });
        const requests = [
          manifestRequest,
          fetch("/models/washington-city/runtime.json", { signal: abortController.signal }),
          fetch(`/data/washington-square-park.json?v=${SHARED_DATA_VERSION}`, { signal: abortController.signal }),
          fetch(`/data/union-square-park.json?v=${SHARED_DATA_VERSION}`, { signal: abortController.signal }),
        ];
        const [manifestResponse, runtimeResponse, washingtonParkResponse, unionParkResponse] = await Promise.all(requests);
        for (const response of [manifestResponse, runtimeResponse, washingtonParkResponse, unionParkResponse]) {
          if (!response.ok) throw new Error(`${response.url} failed (${response.status})`);
        }
        const [manifest, runtime, washingtonPark, unionPark] = await Promise.all([
          manifestResponse.json() as Promise<WashingtonCityManifest>,
          runtimeResponse.json() as Promise<WashingtonCityRuntimeData>,
          washingtonParkResponse.json() as Promise<WashingtonParkData>,
          unionParkResponse.json() as Promise<WashingtonParkData>,
        ]);
        if (disposed) return;
        logLoad("Runtime data parsed", {
          buildings: manifest.buildingCount,
          footprints: runtime.footprints.length,
          tiles: manifest.tiles.length,
        });
        // Begin the nearest city-tile downloads before the synchronous route and
        // landmark construction below. Network/decode work can overlap that CPU
        // phase instead of sitting behind it in the startup waterfall.
        const loadedCityTiles = new Map<string, THREE.Group>();
        const loadingCityTiles = new Set<string>();
        const eligibleCityTiles = manifest.tiles.filter((tile) => tile.x >= HUDSON_MIN_CITY_TILE_X);
        const cityTileByFile = new Map(eligibleCityTiles.map((tile) => [tile.file, tile]));
        let neighborhoodRequest = 0;
        let loadedTiles = 0;
        let ambientRevealAt = Number.POSITIVE_INFINITY;
        const loadTile = async (tile: WashingtonCityManifest["tiles"][number], destination: THREE.Vector3) => {
          if (loadedCityTiles.has(tile.file) || loadingCityTiles.has(tile.file)) return;
          await waitForVisible();
          if (disposed) return;
          loadingCityTiles.add(tile.file);
          let gltf: Awaited<ReturnType<typeof loadGlb>>;
          try {
            gltf = await loadGlb(`/models/washington-city/${tile.file}?v=${manifest.version}`, abortController.signal);
          } catch (error) {
            if (isAbortError(error)) return;
            throw error;
          } finally {
            loadingCityTiles.delete(tile.file);
          }
          if (disposed) return;
          const roadRevealAt = await roadVisualReady;
          if (disposed) return;
          gltf.scene.traverse((object) => {
            if (!(object instanceof THREE.Mesh)) return;
            object.receiveShadow = true;
            object.castShadow = object.name === "wall";
            object.frustumCulled = true;
            object.updateMatrix();
            object.matrixAutoUpdate = false;
          });
          const distance = Math.hypot(tile.x - destination.x, tile.z - destination.z);
          gltf.scene.position.y = -34;
          gltf.scene.visible = false;
          scene.add(gltf.scene);
          loadedCityTiles.set(tile.file, gltf.scene);
          arrivingTiles.push({
            root: gltf.scene,
            materials: [],
            startedAt: Math.max(performance.now(), roadRevealAt + 1170) + Math.min(260, distance * 0.34),
            distance,
            rise: 34,
            fade: false,
            freezeRoot: true,
          });
          renderer.shadowMap.needsUpdate = true;
          loadedTiles += 1;
        };
        const loadNeighborhood = async (center: THREE.Vector3, radius: number, initial = false) => {
          const requestId = ++neighborhoodRequest;
          const orderedTiles = eligibleCityTiles
            .filter((tile) => Math.hypot(tile.x - center.x, tile.z - center.z) < radius)
            .sort((a, b) => Math.hypot(a.x - center.x, a.z - center.z) - Math.hypot(b.x - center.x, b.z - center.z));
          const firstBatchSize = Math.min(4, orderedTiles.length);
          const loadedTilesBeforeFirstBatch = loadedTiles;
          let endFirstCityTiles: ((details?: Record<string, unknown>) => void) | null = null;
          if (!initial) {
            for (const tile of orderedTiles) {
              const root = loadedCityTiles.get(tile.file);
              if (!root || arrivingTiles.some((arrival) => arrival.root === root)) continue;
              const distance = Math.hypot(tile.x - center.x, tile.z - center.z);
              root.matrixAutoUpdate = true;
              root.position.y = -24;
              root.visible = false;
              arrivingTiles.push({
                root,
                materials: [],
                startedAt: performance.now() + Math.min(320, distance * 0.4),
                distance,
                rise: 24,
                fade: false,
                freezeRoot: true,
              });
            }
          }
          for (let index = 0; index < orderedTiles.length; index += 4) {
            await waitForVisible();
            if (disposed || requestId !== neighborhoodRequest) return;
            if (initial && index === 0) {
              endFirstCityTiles = logLoad.start("First city tiles", { requestedTiles: firstBatchSize });
            }
            await Promise.all(orderedTiles.slice(index, index + 4).map((tile) => loadTile(tile, center)));
            if (disposed || requestId !== neighborhoodRequest) return;
            if (initial && index === 0) {
              endFirstCityTiles?.({
                loadedTiles: loadedTiles - loadedTilesBeforeFirstBatch,
                totalLoadedTiles: loadedTiles,
              });
            }
            await yieldToMainThread();
          }
          window.setTimeout(() => {
            if (disposed || requestId !== neighborhoodRequest) return;
            for (const [file, root] of loadedCityTiles) {
              const tile = cityTileByFile.get(file);
              if (!tile || Math.hypot(tile.x - center.x, tile.z - center.z) <= radius) continue;
              scene.remove(root);
              for (let index = arrivingTiles.length - 1; index >= 0; index -= 1) {
                if (arrivingTiles[index].root === root) arrivingTiles.splice(index, 1);
              }
              root.traverse((object) => {
                if (!(object instanceof THREE.Mesh)) return;
                object.geometry.dispose();
                (Array.isArray(object.material) ? object.material : [object.material]).forEach((material) => material.dispose());
              });
              loadedCityTiles.delete(file);
            }
          }, 1800);
        };
        requestNeighborhood = (center, radius) => {
          void loadNeighborhood(center, radius).catch((error) => {
            if (!isAbortError(error)) console.warn(loadLogPrefix, "Neighborhood load failed", error);
          });
        };
        let cityTilesReady = Promise.resolve();
        let cityTilesError: unknown;
        const washingtonTrees = createParkTrees(AMBIENT_LAYOUT.washingtonTrees, "Washington Square");
        const unionAndGramercyTrees = createParkTrees(AMBIENT_LAYOUT.unionTrees, "Union Square and Gramercy Park");
        const contextParkTrees = createParkTrees(AMBIENT_LAYOUT.contextTrees, "Manhattan context park");
        const addCustomLandmarks = async () => {
          const landmarkDetails = createLandmarkDetails(runtime.details);
          const liptonSource = createInteractiveBuildingGroup(runtime.details, ["1008875"], "Lipton Hall source geometry");
          const courantSource = createInteractiveBuildingGroup(runtime.details, ["1008627"], "Courant source geometry");
          const sternSource = createInteractiveBuildingGroup(runtime.details, ["1078952", "1077346"], "Stern source geometry");
          const goldbellySource = createInteractiveBuildingGroup(runtime.details, ["1087304"], "25 Union Square West source geometry");
          const unionSquareCafeSource = createInteractiveBuildingGroup(runtime.details, ["1017906"], "235 Park Avenue South source geometry");
          const liptonDetails = landmarkDetails.get("1008875");
          if (liptonDetails) liptonSource.add(liptonDetails);
          const courantDetails = landmarkDetails.get("1008627");
          if (courantDetails) courantSource.add(courantDetails);
          for (const id of ["1078952", "1077346"]) {
            const details = landmarkDetails.get(id);
            if (details) sternSource.add(details);
          }
          sternSource.add(createSternRotundaDetails());
          const goldbellyDetails = landmarkDetails.get("1087304");
          if (goldbellyDetails) goldbellySource.add(goldbellyDetails);
          const unionSquareCafeDetails = landmarkDetails.get("1017906");
          if (unionSquareCafeDetails) unionSquareCafeSource.add(unionSquareCafeDetails);
          const lipton = bakeLandmarkAsSingleMesh(liptonSource, "Clickable merged Lipton Hall");
          const courant = bakeLandmarkAsSingleMesh(courantSource, "Clickable merged Courant Institute");
          const stern = bakeLandmarkAsSingleMesh(sternSource, "Clickable merged Stern building pair");
          const goldbelly = bakeLandmarkAsSingleMesh(goldbellySource, "Clickable merged 25 Union Square West");
          const unionSquareCafe = bakeLandmarkAsSingleMesh(unionSquareCafeSource, "Clickable merged 235 Park Avenue South");
          registerClickableLandmark(lipton);
          queueSpringArrival(lipton, 0);
          registerClickableLandmark(courant);
          queueSpringArrival(courant, 120);
          registerClickableLandmark(stern);
          queueSpringArrival(stern, 240);
          registerClickableLandmark(goldbelly);
          queueSpringArrival(goldbelly, 280);
          registerClickableLandmark(unionSquareCafe);
          queueSpringArrival(unionSquareCafe, 300);
          createGouldPlaza(scene);
          createCourantGarden(scene);
          for (const [id, details] of landmarkDetails) {
            if (!["1008875", "1008627", "1077346", "1078952", "1087304", "1017906"].includes(id)) {
              scene.add(details);
              queueSpringArrival(details, 320);
            }
          }
          const customLoads: Promise<void>[] = [];
          if (washingtonPark.arch) customLoads.push(loadBlenderArch(washingtonPark.arch, abortController.signal)
            .then((arch) => {
              if (disposed) return;
              scene.add(arch);
              queueSpringArrival(arch, 360);
            })
            .catch((error) => {
              if (disposed || isAbortError(error)) return;
              const arch = createSimpleArch(washingtonPark.arch!, new THREE.MeshStandardMaterial({ color: 0xf1ede4, roughness: 0.86 }));
              scene.add(arch);
              queueSpringArrival(arch, 360);
            }));
          customLoads.push(loadBobstLibrary(abortController.signal)
            .then((bobst) => {
              if (disposed) return;
              registerClickableLandmark(bobst);
              queueSpringArrival(bobst, 480);
            })
            .catch((error) => { if (!isAbortError(error)) console.warn(loadLogPrefix, "Bobst GLB failed", error); }));
          await Promise.all(customLoads);
        };
        logLoad("Ambient geometry ready");
        ground.renderOrder = 0;
        const allParkRings = [
          ...(washingtonPark.parkRings ?? []),
          ...(unionPark.parkRings ?? []),
          ...AMBIENT_LAYOUT.contextParkRings,
        ];
        let parkGround: THREE.Mesh | null = null;
        if (allParkRings.length) {
          const parkSurfaces: CityGmlSurface[] = allParkRings.map((ring) => ({
            kind: "ground",
            ring: ring.map(([x, z]) => [x, 0.74, z] as Point3),
            holes: [],
          }));
          parkGround = new THREE.Mesh(
            makeSurfaceGeometry(parkSurfaces),
            new THREE.MeshStandardMaterial({
              color: 0x9dbd7c,
              roughness: 1,
              side: THREE.DoubleSide,
              stencilWrite: true,
              stencilRef: 1,
              stencilFunc: THREE.NotEqualStencilFunc,
            }),
          );
          parkGround.receiveShadow = true;
          parkGround.name = "OpenStreetMap Manhattan park grass";
          scene.add(parkGround);
          parkGround.visible = false;
        }
        scene.add(createCrosswalks(washingtonPark.crossings, new THREE.MeshBasicMaterial({
          color: 0xfffdf5,
          depthTest: true,
          depthWrite: true,
        })));
        logLoad("Critical park geometry ready");
        // Attach abort handling immediately. This promise is awaited only after
        // deferred scene construction, so React teardown can otherwise reject
        // it before an await has installed a handler and trigger an unhandled
        // rejection in the browser.
        cityTilesReady = loadNeighborhood(MANHATTAN_CENTER, MANHATTAN_TILE_RADIUS, true).catch((error) => {
          if (isAbortError(error)) return;
          cityTilesError = error;
        });
        await waitForVisible();
        if (disposed) return;
        const endDeferredRoutes = logLoad.start("Deferred routes", {
          pedestrians: AMBIENT_LAYOUT.pedestrians.length,
          traffic: AMBIENT_LAYOUT.traffic.length,
          paths: AMBIENT_LAYOUT.parkPaths.length,
        });
        ambientAnimations.push(createPedestrians(scene, () => activeStudy !== "manhattan", () => ambientRevealAt + 500));
        await yieldToMainThread();
        await waitForVisible();
        if (disposed) return;
        ambientAnimations.push(createTraffic(scene, () => ambientRevealAt + 250));
        const parkPaths = createParkPaths(
          new THREE.MeshStandardMaterial({ color: 0xc6baa6, roughness: 1 }),
        );
        scene.add(parkPaths);
        parkPaths.visible = false;
        endDeferredRoutes();
        const fountain = washingtonPark.fountain ? createSimpleFountain(washingtonPark.fountain) : null;
        await cityTilesReady;
        if (cityTilesError) throw cityTilesError;
        await waitForVisible();
        if (disposed) return;
        await addCustomLandmarks();
        ambientRevealAt = performance.now() + 180;
        if (parkGround) queueSpringArrival(parkGround, 0, 18);
        queueSpringArrival(parkPaths, 0);
        scene.add(washingtonTrees, unionAndGramercyTrees, contextParkTrees);
        queueSpringArrival(washingtonTrees, 120);
        queueSpringArrival(unionAndGramercyTrees, 180);
        queueSpringArrival(contextParkTrees, 240);
        if (fountain) {
          scene.add(fountain.group);
          queueSpringArrival(fountain.group, 300);
          ambientAnimations.push(fountain.animation);
        }
        if (!disposed) {
          skyTravelers = createSkyTravelers(scene, skyOverlayScene);
          for (const traveler of skyTravelers) {
            traveler.group.visible = false;
            queueSpringArrival(traveler.group, 1650);
          }
          navigationArrowSpringStartedAt = performance.now() + 1900;
        }
      } catch (error) {
        if (isAbortError(error)) return;
        console.error(loadLogPrefix, "Scene load failed", error);
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
    // Do not expose the renderer's cleared backing buffer. Present the canvas
    // only after its first land-and-riverbed frame has been rendered.
    renderer.render(scene, camera);
    mount.appendChild(renderer.domElement);
    logLoad("Renderer ready", {
      pixelRatio: renderer.getPixelRatio(),
      viewport: `${mount.clientWidth}x${mount.clientHeight}`,
    });

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
      if (shouldAnimate()) {
        for (const resolve of visibilityWaiters) resolve();
        visibilityWaiters.clear();
        startAnimation();
      }
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
      if (activeStudy === "manhattan") return null;
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
    const navigationAtPointer = (event: { clientX: number; clientY: number }) => {
      if (!navigationArrow || activeStudy === "manhattan") return false;
      updatePointerRay(event);
      return raycaster.intersectObject(navigationArrow, true).length > 0;
    };
    const parkDestinationAtPointer = (event: { clientX: number; clientY: number }): MapView | null => {
      if (activeStudy !== "manhattan") return null;
      updatePointerRay(event);
      if (!raycaster.ray.intersectPlane(pointerPlane, pointerWorld)) return null;
      const washingtonDistance = Math.hypot(pointerWorld.x - WASHINGTON_CENTER.x, pointerWorld.z - WASHINGTON_CENTER.z);
      const unionDistance = Math.hypot(pointerWorld.x - UNION_CENTER.x, pointerWorld.z - UNION_CENTER.z);
      if (washingtonDistance > PARK_ZOOM_HIT_RADIUS && unionDistance > PARK_ZOOM_HIT_RADIUS) return null;
      return washingtonDistance <= unionDistance ? "washington" : "union";
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
      const isGoldbelly = landmark.root.name.includes("25 Union Square West");
      const isUnionSquareCafe = landmark.root.name.includes("235 Park Avenue South");
      if (isCourant) desiredCameraTarget.add(new THREE.Vector3(-10, 0, -24));
      desiredCameraAzimuth = isCourant
        ? 0
        : isStern ? Math.PI / 2 + 0.42
          : isBobst ? Math.PI - 0.42
            : isGoldbelly ? Math.PI / 2 + 0.34
              : isUnionSquareCafe ? -Math.PI * 5 / 12 : 0;
      desiredCameraHeight = isLipton ? 273 : isStern ? 252 : isGoldbelly ? 160 : isUnionSquareCafe ? 235 : 210;
      desiredCameraRadius = isLipton ? 285 : isGoldbelly ? 270 : isUnionSquareCafe ? 330 : 365;
      if (isGoldbelly) {
        const originalElevation = Math.atan2(160 - desiredCameraTarget.y, desiredCameraRadius);
        desiredCameraHeight = desiredCameraTarget.y
          + Math.tan(originalElevation + Math.PI / 12) * desiredCameraRadius;
      }
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
      desiredCameraTarget.set(
        activeStudy === "union" ? UNION_CENTER.x : WASHINGTON_CENTER.x,
        28,
        activeStudy === "union" ? UNION_CENTER.z : WASHINGTON_CENTER.z,
      );
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
    let lastPointerHitTestAt = Number.NEGATIVE_INFINITY;
    const pointerDown = (event: PointerEvent) => {
      dragging = !cameraLocked && activeStudy !== "manhattan";
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
      // Pointer devices can dispatch substantially faster than the 30 FPS idle
      // render loop. Raycasting more often cannot produce a visible update.
      if (event.timeStamp - lastPointerHitTestAt < 1000 / 30) return;
      lastPointerHitTestAt = event.timeStamp;
      const hovered = landmarkAtPointer(event);
      clickableLandmarks.forEach((landmark) => { landmark.hovered = landmark === hovered; });
      renderer.domElement.style.cursor = hovered || navigationAtPointer(event) || parkDestinationAtPointer(event) ? "pointer" : "default";
    };
    const pointerUp = (event: PointerEvent) => {
      if (!pointerMoved) {
        const parkDestination = parkDestinationAtPointer(event);
        if (parkDestination) {
          switchStudyRef.current(parkDestination);
          return;
        }
        if (navigationAtPointer(event)) {
          switchStudyRef.current(activeStudy === "union" ? "washington" : "union");
        }
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
      if (event.deltaY > 0) {
        event.preventDefault();
        window.clearTimeout(zoomOutGestureReset);
        zoomOutGestureReset = window.setTimeout(() => {
          zoomOutGestureActive = false;
        }, BLOCKED_ZOOM_GESTURE_SETTLE_MS);
        if (zoomOutGestureActive) return;
        zoomOutGestureActive = true;
      }
      if (cameraLocked) {
        if (event.deltaY > 0) {
          clearLandmarkSelection();
        }
        return;
      }
      if (event.deltaY > 0 && activeStudy !== "manhattan") {
        switchStudyRef.current("manhattan");
        return;
      }
      if (event.deltaY >= 0) return;
      event.preventDefault();
      window.clearTimeout(blockedZoomGestureReset);
      blockedZoomGestureReset = window.setTimeout(() => {
        blockedZoomGestureActive = false;
      }, BLOCKED_ZOOM_GESTURE_SETTLE_MS);
      if (blockedZoomGestureActive) return;
      blockedZoomGestureActive = true;
      const parkDestination = parkDestinationAtPointer(event);
      if (parkDestination) {
        switchStudyRef.current(parkDestination);
        return;
      }
      const hovered = landmarkAtPointer(event);
      if (hovered) {
        selectLandmark(hovered);
        return;
      }
      updatePointerRay(event);
      blockedZoomOrigin.copy(cameraTarget);
      blockedZoomOriginZoom = camera.zoom;
      if (raycaster.ray.intersectPlane(pointerPlane, pointerWorld)) {
        blockedZoomFocus.copy(pointerWorld).setY(cameraTarget.y);
      } else {
        blockedZoomFocus.copy(cameraTarget);
      }
      blockedZoomStartedAt = performance.now();
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
      const interactionNeedsFullFrameRate = dragging || cameraTransitioning || blockedZoomStartedAt > 0;
      if (!interactionNeedsFullFrameRate && now - previousRender < 1000 / 30) return;
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
        camera.zoom = blockedZoomOriginZoom * (1 + pulse * (BLOCKED_ZOOM_SCALE - 1));
        cameraTarget.copy(blockedZoomOrigin).lerp(blockedZoomFocus, pulse * 0.035);
        camera.updateProjectionMatrix();
        updateCamera();
        if (progress >= 1) {
          camera.zoom = blockedZoomOriginZoom;
          cameraTarget.copy(blockedZoomOrigin);
          camera.updateProjectionMatrix();
          updateCamera();
          blockedZoomStartedAt = 0;
        }
      }
      for (const traveler of skyTravelers) {
        traveler.group.visible = traveler.view === "manhattan"
          ? activeStudy === "manhattan"
          : activeStudy !== "manhattan";
        if (!traveler.group.visible) continue;
        const span = traveler.endX - traveler.startX;
        const axis = traveler.axis ?? "x";
        traveler.group.position[axis] = traveler.startX
          + ((traveler.group.position[axis] - traveler.startX + traveler.speed * delta + span) % span);
        traveler.group.position.y = traveler.baseY
          + Math.sin(elapsed * 0.55 + traveler.phase) * (traveler.bobAmount ?? 3.5);
        traveler.flap?.(elapsed);
      }
      if (navigationArrow && activeStudy !== "manhattan" && now >= navigationArrowSpringStartedAt) {
        navigationArrow.visible = true;
        if (!navigationArrowSpringComplete) {
          const progress = THREE.MathUtils.clamp(
            (now - navigationArrowSpringStartedAt) / NAVIGATION_ARROW_SPRING_DURATION_MS,
            0,
            1,
          );
          const spring = 1 - Math.exp(-4.8 * progress) * Math.cos(12.5 * progress);
          navigationArrow.scale.setScalar(NAVIGATION_ARROW_SCALE * Math.max(0.001, spring));
          navigationArrow.position.y = NAVIGATION_ARROW_Y - 34 * (1 - spring);
          if (progress >= 1) {
            navigationArrowSpringComplete = true;
            navigationArrow.scale.setScalar(NAVIGATION_ARROW_SCALE);
          }
        } else {
          navigationArrow.position.y = NAVIGATION_ARROW_Y + Math.sin(elapsed * 1.8) * 3;
        }
      }
      ambientAnimations.forEach((animation) => animation.update(elapsed, now));
      for (let index = arrivingTiles.length - 1; index >= 0; index -= 1) {
        const arrival = arrivingTiles[index];
        if (now < arrival.startedAt) {
          arrival.root.visible = false;
          continue;
        }
        arrival.root.visible = true;
        const duration = arrival.durationMs ?? (arrival.rise === 0 ? 220 : 1120);
        const progress = THREE.MathUtils.clamp((now - arrival.startedAt) / duration, 0, 1);
        const spring = 1 - Math.exp(-4.8 * progress) * Math.cos(12.5 * progress);
        const targetY = arrival.targetY ?? 0;
        arrival.root.position.y = targetY - arrival.rise * (1 - spring);
        if (arrival.fade) {
          const opacity = THREE.MathUtils.smoothstep(progress, 0, 1);
          for (const material of arrival.materials) material.opacity = opacity;
        }
        if (progress >= 1) {
          arrival.root.position.y = targetY;
          if (arrival.freezeRoot) {
            arrival.root.updateMatrix();
            arrival.root.matrixAutoUpdate = false;
          }
          for (const material of arrival.materials) {
            material.opacity = 1;
            if (!arrival.fade) material.transparent = false;
            material.depthWrite = true;
            material.needsUpdate = true;
          }
          arrivingTiles.splice(index, 1);
          renderer.shadowMap.needsUpdate = true;
        }
      }
      const renderStarted = performance.now();
      renderer.clear(true, true, true);
      renderer.render(scene, camera);
      renderer.clearDepth();
      renderer.render(skyOverlayScene, camera);
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
      // Do not abort the shared browser fetch signal during React/HMR teardown.
      // Some response/body promises owned by the browser can reject outside
      // the explicit async chain and surface as an unhandled AbortError. Every
      // async scene branch checks `disposed` before mounting decoded results,
      // so letting in-flight requests settle is safe and keeps cleanup quiet.
      for (const resolve of visibilityWaiters) resolve();
      visibilityWaiters.clear();
      cancelAnimationFrame(frame);
      observer.disconnect();
      intersectionObserver.disconnect();
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("popstate", handlePopState);
      renderer.domElement.removeEventListener("pointerdown", pointerDown);
      renderer.domElement.removeEventListener("pointermove", pointerMove);
      renderer.domElement.removeEventListener("pointerup", pointerUp);
      renderer.domElement.removeEventListener("pointercancel", pointerUp);
      window.removeEventListener("keydown", keyDown);
      renderer.domElement.removeEventListener("wheel", wheel);
      window.clearTimeout(blockedZoomGestureReset);
      window.clearTimeout(zoomOutGestureReset);
      const disposedGeometries = new Set<THREE.BufferGeometry>();
      const disposedMaterials = new Set<THREE.Material>();
      const disposeObjectResources = (object: THREE.Object3D) => {
        if (object instanceof THREE.Mesh || object instanceof THREE.LineSegments) {
          if (!disposedGeometries.has(object.geometry)) {
            disposedGeometries.add(object.geometry);
            object.geometry.dispose();
          }
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          materials.forEach((material) => {
            if (disposedMaterials.has(material)) return;
            disposedMaterials.add(material);
            material.dispose();
          });
        }
      };
      scene.traverse(disposeObjectResources);
      skyOverlayScene.traverse(disposeObjectResources);
      timer.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      switchStudyRef.current = () => undefined;
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
