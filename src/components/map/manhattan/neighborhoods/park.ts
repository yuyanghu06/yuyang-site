import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { AMBIENT_LAYOUT } from "../../../../generated/ambient-layout";
import type {
  AmbientAnimation,
  CityGmlSurface,
  Point3,
  WashingtonParkData,
} from "../../shared/core";

export function projectedRing(ring: Point3[], normal: THREE.Vector3) {
  const axis = normal.clone().set(Math.abs(normal.x), Math.abs(normal.y), Math.abs(normal.z));
  if (axis.x >= axis.y && axis.x >= axis.z) return ring.map(([, y, z]) => new THREE.Vector2(z, y));
  if (axis.y >= axis.z) return ring.map(([x, , z]) => new THREE.Vector2(x, z));
  return ring.map(([x, y]) => new THREE.Vector2(x, y));
}

export function surfaceNormal(ring: Point3[]) {
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

export function makeSurfaceGeometry(surfaces: CityGmlSurface[]) {
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

export function createParkPaths(material: THREE.Material) {
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

export function createParkTrees(
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

export function createSimpleFountain(data: NonNullable<WashingtonParkData["fountain"]>) {
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

export function createSimpleArch(data: NonNullable<WashingtonParkData["arch"]>, material: THREE.Material) {
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

export async function loadGlb(url: string, signal: AbortSignal) {
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`${url} failed (${response.status})`);
  const buffer = await response.arrayBuffer();
  return new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(buffer, "");
}

export async function loadBlenderArch(
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

export async function loadBobstLibrary(signal: AbortSignal) {
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

export function createCrosswalks(data: WashingtonParkData["crossings"], material: THREE.Material) {
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

