import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { Point3, SurfaceKind, WashingtonCityRuntimeData } from "../../shared/core";
import { pointInRing } from "../ambient/street-life";
import { makeSurfaceGeometry, surfaceNormal } from "./park";

export const INTERACTIVE_BUILDING_COLORS: Record<string, Record<SurfaceKind, number>> = {
  "1008875": { wall: 0x956553, roof: 0xb8aa9b, ground: 0x777872 },
  "1008627": { wall: 0x6f5d54, roof: 0x8d8176, ground: 0x63534c },
  "1077346": { wall: 0x8f5e50, roof: 0xaaa094, ground: 0x785047 },
  "1078952": { wall: 0xa9aaa5, roof: 0xc4c0b6, ground: 0x96958f },
  "1087304": { wall: 0xc49b72, roof: 0x94a184, ground: 0xa98568 },
  "1017906": { wall: 0xc7aa83, roof: 0x9b9384, ground: 0xa18d72 },
};

export function createInteractiveBuildingGroup(
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

export function bakeLandmarkAsSingleMesh(source: THREE.Object3D, name: string) {
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

export function createLandmarkDetails(details: WashingtonCityRuntimeData["details"]) {
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

export function createSternRotundaDetails() {
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

export function createGouldPlaza(scene: THREE.Scene) {
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

export function createCourantGarden(scene: THREE.Scene) {
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

