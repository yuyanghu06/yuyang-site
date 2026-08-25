"use client";

import { useCallback, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import AvatarFullscreen, { type AvatarAnimationSource } from "../../components/avatar-view/avatar-fullscreen";
import styles from "./preview.module.css";

const IDLE_URL = "/animations/idle.glb?v=20260824-user-texture-paint-pass-4";
const NEUTRAL_FACE_URL = "/style-references/avatar/yuyang-avatar-neutral-face-approved.png?v=20260822-approved";
const SCRIPT_SECONDS = 10;

const smoothPulse = (time: number, start: number, duration: number) => {
  if (time < start || time >= start + duration) return 0;
  const progress = (time - start) / duration;
  return Math.sin(progress * Math.PI) ** 2;
};

const configureTexture = (texture: THREE.Texture) => {
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.flipY = false;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
};

async function loadPreviewAvatar(setLabel: (label: string) => void): Promise<AvatarAnimationSource> {
  const loader = new GLTFLoader();
  const gltf = await loader.loadAsync(IDLE_URL);
  const idle = gltf.animations.find((clip) => clip.name === "Idle_Loop");
  if (!idle) throw new Error("Preview avatar is missing Idle_Loop");

  const mixer = new THREE.AnimationMixer(gltf.scene);
  mixer.clipAction(idle).play();
  const head = gltf.scene.getObjectByName("Head");
  const neck = gltf.scene.getObjectByName("neck");
  const face = gltf.scene.getObjectByName("Yuyang_EmbeddedFace");
  if (!head || !neck || !(face instanceof THREE.Mesh) || !(face.material instanceof THREE.MeshStandardMaterial)) {
    throw new Error("Preview avatar is missing its head, neck, or illustrated face");
  }

  const textureLoader = new THREE.TextureLoader();
  const neutral = await textureLoader.loadAsync(NEUTRAL_FACE_URL);
  configureTexture(neutral);

  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Could not create preview face canvas");
  const faceTexture = new THREE.CanvasTexture(canvas);
  configureTexture(faceTexture);
  const faceMaterial = face.material.clone();
  face.material = faceMaterial;
  faceMaterial.map = faceTexture;
  faceMaterial.needsUpdate = true;

  let lastFace = "";
  let lastLabel = "";
  const drawFace = (state: "neutral" | "smile" | "disappointed") => {
    if (lastFace === state) return;
    context.clearRect(0, 0, 512, 512);
    context.drawImage(neutral.image as CanvasImageSource, 0, 0, 512, 512);
    if (state === "smile") {
      context.clearRect(170, 350, 172, 126);
      context.fillStyle = "#a96861";
      context.beginPath();
      context.moveTo(198, 383);
      context.quadraticCurveTo(256, 375, 314, 383);
      context.quadraticCurveTo(304, 454, 256, 458);
      context.quadraticCurveTo(208, 454, 198, 383);
      context.closePath();
      context.fill();
      context.fillStyle = "#fff5e8";
      context.beginPath();
      context.moveTo(207, 388);
      context.quadraticCurveTo(256, 382, 305, 388);
      context.lineTo(297, 411);
      context.quadraticCurveTo(256, 416, 215, 411);
      context.closePath();
      context.fill();
      context.fillStyle = "#e99086";
      context.beginPath();
      context.moveTo(218, 432);
      context.quadraticCurveTo(256, 419, 294, 432);
      context.quadraticCurveTo(279, 450, 256, 452);
      context.quadraticCurveTo(233, 450, 218, 432);
      context.closePath();
      context.fill();
    } else if (state === "disappointed") {
      context.clearRect(82, 128, 348, 92);
      context.clearRect(170, 360, 172, 100);
      context.lineCap = "round";
      context.lineWidth = 18;
      context.strokeStyle = "#2b2521";
      context.beginPath();
      context.moveTo(105, 174); context.lineTo(205, 148);
      context.moveTo(307, 148); context.lineTo(407, 174);
      context.stroke();
      context.lineWidth = 8;
      context.strokeStyle = "#4a3428";
      context.beginPath();
      context.moveTo(105, 209); context.quadraticCurveTo(156, 233, 207, 209);
      context.moveTo(305, 209); context.quadraticCurveTo(356, 233, 407, 209);
      context.stroke();
      context.fillStyle = "#b96f68";
      context.beginPath();
      context.moveTo(204, 414);
      context.quadraticCurveTo(256, 386, 308, 414);
      context.quadraticCurveTo(256, 397, 204, 414);
      context.closePath();
      context.fill();
    }
    faceTexture.needsUpdate = true;
    lastFace = state;
  };

  return {
    root: gltf.scene,
    mixer,
    start: () => drawFace("neutral"),
    update: (elapsedSeconds) => {
      const time = elapsedSeconds % SCRIPT_SECONDS;
      const nod = smoothPulse(time, 2, 2);
      const shake = smoothPulse(time, 6, 2);
      const nodAngle = Math.sin((time - 2) * Math.PI * 2) * nod * THREE.MathUtils.degToRad(6);
      const shakeAngle = Math.sin((time - 6) * Math.PI * 3) * shake * THREE.MathUtils.degToRad(10);
      head.rotateX(nodAngle * 0.7);
      neck.rotateX(nodAngle * 0.3);
      head.rotateY(shakeAngle * 0.75);
      neck.rotateY(shakeAngle * 0.25);

      const label = time < 2 ? "Neutral" : time < 4 ? "Nod + open smile" : time < 6 ? "Neutral" : time < 8 ? "Head shake + disappointed face" : "Neutral";
      if (label !== lastLabel) {
        lastLabel = label;
        setLabel(label);
      }
      drawFace(time >= 2 && time < 4 ? "smile" : time >= 6 && time < 8 ? "disappointed" : "neutral");
    },
    dispose: () => {
      neutral.dispose();
      faceTexture.dispose();
    },
  };
}

export default function AvatarEmotePreview() {
  const [label, setLabel] = useState("Loading preview…");
  const loadAvatar = useCallback(() => loadPreviewAvatar(setLabel), []);

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <p>Avatar animation test script</p>
        <h1>{label}</h1>
        <span>Loops every 10 seconds. Production behavior is unchanged.</span>
      </header>
      <section className={styles.stage}>
        <AvatarFullscreen
          ariaLabel="Avatar nod and head-shake animation preview"
          loadAvatar={loadAvatar}
          loadErrorMessage="[AvatarPreview] Could not load avatar"
          renderStyle="flat-illustrated-preview"
        />
      </section>
    </main>
  );
}
