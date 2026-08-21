"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

const IDLE_MODEL_URL = "/models/yuyang-avatar-idle-loop-v2.glb";
const FACE_ATLAS_URL = "/style-references/avatar/yuyang-avatar-face-talking-atlas.png";
const PLANTED_BONES = [
  "LeftUpLeg",
  "LeftLeg",
  "LeftFoot",
  "LeftToeBase",
  "RightUpLeg",
  "RightLeg",
  "RightFoot",
  "RightToeBase",
];

function createPlantedIdle(source: THREE.AnimationClip) {
  const tracks = source.tracks.filter((track) => {
    if (PLANTED_BONES.some((boneName) => track.name.includes(boneName))) return false;
    if (track.name.includes("Hips") && !track.name.endsWith(".position")) return false;
    return true;
  });
  return new THREE.AnimationClip(`${source.name}_Planted`, source.duration, tracks);
}

function createSmilingFaceTexture(image: HTMLImageElement) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Could not create the avatar face texture");
  context.filter = "saturate(145%) brightness(72%) contrast(122%)";
  context.drawImage(image, 0, 0, 512, 512, 0, 0, 512, 512);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}

function createFaceCanvas(texture: THREE.Texture) {
  const columns = 12;
  const rows = 16;
  const width = 0.205;
  const height = 0.255;
  // Blender authoring is Z-up; glTF/Three.js is Y-up. Convert the approved
  // Blender canvas coordinates as (x, y, z) -> (x, z, -y).
  const center = new THREE.Vector3(-0.004, 1.44, 0.166);
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let row = 0; row <= rows; row += 1) {
    const v = row / rows;
    for (let column = 0; column <= columns; column += 1) {
      const u = column / columns;
      const normalizedX = (u - 0.5) * 2;
      positions.push(
        center.x + (u - 0.5) * width,
        center.y + (v - 0.5) * height,
        center.z - 0.025 * normalizedX * normalizedX,
      );
      uvs.push(u, v);
    }
  }

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const a = row * (columns + 1) + column;
      const b = a + 1;
      const d = (row + 1) * (columns + 1) + column;
      const c = d + 1;
      indices.push(a, d, b, b, d, c);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  return new THREE.Mesh(
    geometry,
    new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      alphaTest: 0.02,
      depthWrite: false,
      side: THREE.DoubleSide,
      toneMapped: false,
    }),
  );
}

function createDropShadow() {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 128;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Could not create the avatar shadow");
  const gradient = context.createRadialGradient(128, 64, 4, 128, 64, 112);
  gradient.addColorStop(0, "rgba(20, 27, 27, 0.36)");
  gradient.addColorStop(0.45, "rgba(20, 27, 27, 0.17)");
  gradient.addColorStop(1, "rgba(20, 27, 27, 0)");
  context.fillStyle = gradient;
  context.fillRect(0, 0, 256, 128);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false }),
  );
  sprite.position.set(0, 0.035, 0.08);
  sprite.scale.set(0.72, 0.18, 1);
  sprite.renderOrder = -1;
  return sprite;
}

export default function AvatarIdleView({ framing = "full" }: { framing?: "full" | "bust" }) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.01, 20);
    const cameraCenterY = framing === "bust" ? 1.28 : 0.85;
    camera.position.set(0, cameraCenterY, 4.8);
    camera.lookAt(0, cameraCenterY, 0);

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    host.appendChild(renderer.domElement);

    scene.add(new THREE.HemisphereLight(0xfffbf2, 0x46504e, 2.15));
    const key = new THREE.DirectionalLight(0xfff1dd, 3.1);
    key.position.set(-2.2, 3.5, 4.2);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xdce8e2, 1.35);
    fill.position.set(2.8, 2.2, 1.6);
    scene.add(fill);

    const shadow = createDropShadow();
    scene.add(shadow);

    let mixer: THREE.AnimationMixer | null = null;
    let avatarRoot: THREE.Object3D | null = null;
    let faceTexture: THREE.Texture | null = null;
    let plantedFootHeight: number | null = null;
    let avatarBaseY = 0;
    let footBones: THREE.Object3D[] = [];
    let disposed = false;
    const clock = new THREE.Clock();
    let animationFrame = 0;

    const resize = () => {
      const { width, height } = host.getBoundingClientRect();
      if (width <= 0 || height <= 0) return;
      renderer.setSize(width, height, false);
      const viewHeight = framing === "bust" ? 0.92 : 1.92;
      const viewWidth = viewHeight * (width / height);
      camera.left = -viewWidth / 2;
      camera.right = viewWidth / 2;
      camera.top = viewHeight / 2;
      camera.bottom = -viewHeight / 2;
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    window.addEventListener("avatar-call-resize", resize);
    resize();
    const postTransitionResize = window.setTimeout(resize, 520);

    Promise.all([
      new GLTFLoader().loadAsync(IDLE_MODEL_URL),
      new THREE.ImageLoader().loadAsync(FACE_ATLAS_URL),
    ])
      .then(([gltf, atlasImage]) => {
        if (disposed) return;
        avatarRoot = gltf.scene;
        scene.add(avatarRoot);
        avatarRoot.traverse((object) => {
          if (!(object instanceof THREE.Mesh)) return;
          object.frustumCulled = false;
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          for (const material of materials) {
            if ("roughness" in material) material.roughness = 0.72;
          }
        });

        const head = avatarRoot.getObjectByName("Head");
        if (head) {
          faceTexture = createSmilingFaceTexture(atlasImage);
          const face = createFaceCanvas(faceTexture);
          scene.add(face);
          head.attach(face);
          face.renderOrder = 3;
        }

        if (gltf.animations.length > 0) {
          mixer = new THREE.AnimationMixer(avatarRoot);
          mixer.clipAction(createPlantedIdle(gltf.animations[0])).play();
          mixer.update(0);
        }
        avatarBaseY = avatarRoot.position.y;
        footBones = ["LeftFoot", "RightFoot", "LeftToeBase", "RightToeBase"]
          .map((name) => avatarRoot?.getObjectByName(name))
          .filter((bone): bone is THREE.Object3D => bone !== undefined);
        avatarRoot.updateMatrixWorld(true);
        const footPosition = new THREE.Vector3();
        plantedFootHeight = Math.min(
          ...footBones.map((bone) => bone.getWorldPosition(footPosition).y),
        );
        host.dataset.ready = "true";
      })
      .catch((error: unknown) => {
        console.error("[AvatarCall] Could not load idle avatar", error);
        host.dataset.error = "true";
      });

    const render = () => {
      animationFrame = requestAnimationFrame(render);
      const delta = Math.min(clock.getDelta(), 0.05);
      mixer?.update(delta);
      if (avatarRoot && plantedFootHeight !== null && footBones.length > 0) {
        avatarRoot.position.y = avatarBaseY;
        avatarRoot.updateMatrixWorld(true);
        const footPosition = new THREE.Vector3();
        const currentFootHeight = Math.min(
          ...footBones.map((bone) => bone.getWorldPosition(footPosition).y),
        );
        avatarRoot.position.y = avatarBaseY + plantedFootHeight - currentFootHeight;
        avatarRoot.updateMatrixWorld(true);
      }
      renderer.render(scene, camera);
    };
    render();

    return () => {
      disposed = true;
      cancelAnimationFrame(animationFrame);
      observer.disconnect();
      window.removeEventListener("avatar-call-resize", resize);
      window.clearTimeout(postTransitionResize);
      mixer?.stopAllAction();
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh || object instanceof THREE.Sprite) {
          object.geometry?.dispose();
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          for (const material of materials) material.dispose();
        }
      });
      faceTexture?.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [framing]);

  return <div ref={hostRef} className="avatar-call__avatar-view" aria-label="Smiling Yuyang avatar idling" />;
}
