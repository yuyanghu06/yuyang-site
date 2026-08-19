"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

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

const PARK_CENTER = new THREE.Vector3(0, 0, 0);
const ARCH_CENTER = new THREE.Vector3(21.1, 0, 0);

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
  0xd2c6af,
  0xddd3c1,
  0xd7c3ad,
  0xcfafa2,
  0xc6b59b,
  0xb9beb0,
  0xd8ccc2,
  0xe3d6bd,
];

function buildingColor(id: string, kind: SurfaceKind) {
  let hash = 2166136261;
  for (let index = 0; index < id.length; index += 1) {
    hash ^= id.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  const color = new THREE.Color(BUILDING_PALETTE[Math.abs(hash) % BUILDING_PALETTE.length]);
  if (kind === "roof") color.offsetHSL(0, -0.03, 0.045);
  if (kind === "ground") color.offsetHSL(0, -0.08, 0.04);
  return color;
}

function box(
  parent: THREE.Object3D,
  size: [number, number, number],
  position: [number, number, number],
  material: THREE.Material,
) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
  mesh.position.set(...position);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function createArch(material: THREE.Material) {
  const arch = new THREE.Group();
  box(arch, [6.5, 25, 8], [-12, 12.5, 0], material);
  box(arch, [6.5, 25, 8], [12, 12.5, 0], material);
  box(arch, [31, 7.5, 8], [0, 27.5, 0], material);
  box(arch, [21, 4, 8], [0, 33.25, 0], material);
  box(arch, [13, 2.5, 8], [0, 36.5, 0], material);
  arch.position.copy(ARCH_CENTER).add(new THREE.Vector3(0, 1, 0));
  arch.name = "Washington Square Arch";
  return arch;
}

function createCrosswalks(material: THREE.Material) {
  const crossings = new THREE.Group();
  const addCrosswalk = (x: number, z: number, angle: number) => {
    const crossing = new THREE.Group();
    for (let stripe = -4; stripe <= 4; stripe += 1) {
      const marking = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.045, 3.8), material);
      marking.position.x = stripe * 1.42;
      marking.receiveShadow = true;
      marking.renderOrder = 3;
      crossing.add(marking);
    }
    crossing.position.set(x, 0.18, z);
    crossing.rotation.y = -angle;
    crossings.add(crossing);
  };

  // Washington Square's four corners, with one crossing on each adjoining street.
  addCrosswalk(-270, -182, Math.PI / 2);
  addCrosswalk(-283, -171, 0);
  addCrosswalk(102, -206, Math.PI / 2);
  addCrosswalk(110, -197, 0);
  addCrosswalk(-287, 204, Math.PI / 2);
  addCrosswalk(-309, 190, 0);
  addCrosswalk(119, 182, Math.PI / 2);
  addCrosswalk(134, 167, 0);

  crossings.name = "Washington Square crosswalk markings";
  crossings.renderOrder = 2;
  return crossings;
}

export default function Nyc3dMap() {
  const mountRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState("Building Washington Square");

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    let disposed = false;
    let frame = 0;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xeee4d2);
    scene.fog = new THREE.Fog(0xeee4d2, 900, 1600);

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
    renderer.toneMappingExposure = 0.96;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.className = "washington-canvas";
    mount.appendChild(renderer.domElement);

    scene.add(new THREE.HemisphereLight(0xfff8eb, 0xb9b3a8, 2.45));
    const sun = new THREE.DirectionalLight(0xffe8c7, 1.2);
    sun.position.copy(PARK_CENTER).add(new THREE.Vector3(-650, 950, 520));
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -850;
    sun.shadow.camera.right = 850;
    sun.shadow.camera.top = 850;
    sun.shadow.camera.bottom = -850;
    sun.shadow.bias = -0.00015;
    sun.shadow.radius = 5;
    scene.add(sun);

    const sidewalkMaterial = new THREE.MeshStandardMaterial({
      color: 0xb8b8b3,
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

    Promise.all([
      fetch("/data/washington-square-citygml.json"),
      fetch("/data/washington-square-planimetrics.json"),
    ])
      .then(async ([cityResponse, planimetricsResponse]) => {
        if (!cityResponse.ok) throw new Error(`CityGML request failed (${cityResponse.status})`);
        if (!planimetricsResponse.ok) throw new Error(`Planimetrics request failed (${planimetricsResponse.status})`);
        return Promise.all([
          cityResponse.json() as Promise<WashingtonCityGmlData>,
          planimetricsResponse.json() as Promise<WashingtonPlanimetricsData>,
        ]);
      })
      .then(([data, planimetrics]) => {
        if (disposed) return;
        const roadSurfaces: CityGmlSurface[] = planimetrics.roadbeds.map((roadbed) => ({
          kind: "ground",
          ring: roadbed.ring.map(([x, z]) => [x, 0.12, z]),
          holes: roadbed.holes.map((hole) => hole.map(([x, z]) => [x, 0.12, z])),
        }));
        const roadMaterial = new THREE.MeshStandardMaterial({
          color: 0x77746d,
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
        scene.add(createCrosswalks(new THREE.MeshStandardMaterial({
          color: 0xf0ece2,
          roughness: 1,
          depthTest: false,
          depthWrite: false,
          stencilWrite: true,
          stencilRef: 1,
          stencilFunc: THREE.EqualStencilFunc,
        })));

        const surfaces: Record<SurfaceKind, CityGmlSurface[]> = { ground: [], roof: [], wall: [] };
        for (const building of data.buildings) {
          const id = building.bin ?? building.doittId ?? building.sourceId ?? "building";
          for (const surface of building.surfaces) {
            surfaces[surface.kind].push({ ...surface, color: buildingColor(id, surface.kind) });
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
        scene.add(createArch(new THREE.MeshStandardMaterial({ color: 0xd8c19c, roughness: 1 })));
        setStatus("");
      })
      .catch((error: Error) => setStatus(error.message));

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
