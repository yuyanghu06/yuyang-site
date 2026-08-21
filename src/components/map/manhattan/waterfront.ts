import * as THREE from "three";
import { HUDSON_WATERFRONT } from "../../../generated/hudson-waterfront";

export type HorizontalRing = readonly (readonly [number, number])[];

export function createHorizontalShapeGeometry(outer: HorizontalRing, holes: readonly HorizontalRing[] = [], depth = 0) {
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

export function createRoadRibbonGeometry(points: HorizontalRing, width: number) {
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

export function createWaterMaterial() {
  return new THREE.MeshStandardMaterial({
    color: 0x354345,
    roughness: 0.76,
    metalness: 0.08,
  });
}

export function createHudsonWaterAndPier() {
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

export function createEastRiverWaterAndPiers() {
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


