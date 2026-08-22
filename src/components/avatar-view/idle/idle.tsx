"use client";

import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import AvatarFullscreen, { type AvatarAnimationSource } from "../avatar-fullscreen";

const IDLE_MODEL_URL = "/animations/idle.glb?v=20260822-user-approved-manual-face-fit";
const NEUTRAL_FACE_URL = "/style-references/avatar/yuyang-avatar-neutral-face-approved.png?v=20260822-approved";
const BLINK_FACE_URL = "/style-references/avatar/yuyang-avatar-neutral-face-blink-closed.png?v=20260822-closed-eyes";
const TALKING_MOUTH_URLS = [0, 1, 2, 3].map(
  (index) => `/style-references/avatar/yuyang-avatar-talking-mouth-${index}.png?v=20260822-independent-mouth`,
);

const TALKING_MOUTH_SEQUENCE = [1, 2, 3, 1, null, 2, 1, 3] as const;
const TALKING_MOUTH_STEP_SECONDS = 0.08;

function configureFaceTexture(texture: THREE.Texture) {
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.flipY = false;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
}

async function loadIdleAvatar(): Promise<AvatarAnimationSource> {
  const gltf = await new GLTFLoader().loadAsync(IDLE_MODEL_URL);
  const idleClip = gltf.animations.find((clip) => clip.name === "Idle_Loop");
  if (!idleClip) throw new Error("Embedded avatar GLB is missing Idle_Loop");

  const mixer = new THREE.AnimationMixer(gltf.scene);
  mixer.clipAction(idleClip).play();
  mixer.update(0);

  const face = gltf.scene.getObjectByName("Yuyang_EmbeddedFace");
  if (!(face instanceof THREE.Mesh) || !(face.material instanceof THREE.MeshStandardMaterial)) {
    throw new Error("Embedded avatar GLB is missing the illustrated face material");
  }

  const material = face.material.clone();
  face.material = material;
  if (!material.map) throw new Error("Embedded avatar face is missing its neutral texture");

  const textureLoader = new THREE.TextureLoader();
  const [neutralTexture, blinkTexture, ...talkingMouthTextures] = await Promise.all([
    textureLoader.loadAsync(NEUTRAL_FACE_URL),
    textureLoader.loadAsync(BLINK_FACE_URL),
    ...TALKING_MOUTH_URLS.map((url) => textureLoader.loadAsync(url)),
  ]);
  configureFaceTexture(neutralTexture);
  configureFaceTexture(blinkTexture);
  talkingMouthTextures.forEach(configureFaceTexture);

  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Could not create the animated avatar face canvas");
  const animatedFaceTexture = new THREE.CanvasTexture(canvas);
  configureFaceTexture(animatedFaceTexture);
  material.map = animatedFaceTexture;
  material.needsUpdate = true;

  let talkingStartedAt: number | null = null;
  let activeState = "";
  const drawFace = (eyesClosed: boolean, mouth: number | null) => {
    const key = `${eyesClosed ? "closed" : "open"}-${mouth ?? "neutral"}`;
    if (activeState === key) return;
    context.clearRect(0, 0, 512, 512);
    context.drawImage((eyesClosed ? blinkTexture : neutralTexture).image as CanvasImageSource, 0, 0, 512, 512);
    if (mouth !== null) {
      context.clearRect(165, 350, 185, 126);
      context.drawImage(talkingMouthTextures[mouth].image as CanvasImageSource, 0, 0, 512, 512);
    }
    animatedFaceTexture.needsUpdate = true;
    activeState = key;
  };

  return {
    root: gltf.scene,
    mixer,
    update: (elapsedSeconds, talking) => {
      const blinkClock = elapsedSeconds % 5;
      const eyesClosed = (blinkClock >= 2.15 && blinkClock < 2.27) || (blinkClock >= 4.35 && blinkClock < 4.47);

      if (talking) {
        talkingStartedAt ??= elapsedSeconds;
        const mouth = TALKING_MOUTH_SEQUENCE[
          Math.floor((elapsedSeconds - talkingStartedAt) / TALKING_MOUTH_STEP_SECONDS) % TALKING_MOUTH_SEQUENCE.length
        ];
        drawFace(eyesClosed, mouth);
        return;
      }

      talkingStartedAt = null;
      drawFace(eyesClosed, null);
    },
    dispose: () => {
      neutralTexture.dispose();
      blinkTexture.dispose();
      talkingMouthTextures.forEach((texture) => texture.dispose());
      animatedFaceTexture.dispose();
    },
  };
}

export default function AvatarIdle({ onReady, talking = false }: { onReady?: () => void; talking?: boolean }) {
  return (
    <AvatarFullscreen
      ariaLabel="Smiling Yuyang avatar idling"
      loadAvatar={loadIdleAvatar}
      loadErrorMessage="[AvatarCall] Could not load idle avatar"
      onReady={onReady}
      talking={talking}
    />
  );
}
