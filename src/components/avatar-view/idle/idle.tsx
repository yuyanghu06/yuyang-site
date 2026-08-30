"use client";

import { useCallback } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { AVATAR_EMOTE_REQUEST_EVENT, type AvatarEmote, type AvatarEmoteRequestDetail } from "@/agent/contracts/types";
import AvatarFullscreen, { type AvatarAnimationSource } from "../avatar-fullscreen";
import { createAvatarEmotePlayer } from "../avatar-emote-player";

const IDLE_MODEL_URL = "/animations/idle.glb?v=20260824-user-texture-paint-pass-4";
const WAVE_MODEL_URL = "/animations/wave-hello-review-v2.glb?v=20260824-animation-only-1";
const NOD_MODEL_URL = "/animations/nod-smile.glb?v=20260824-animation-only-1";
const SHAKE_MODEL_URL = "/animations/head-shake-disappointed.glb?v=20260824-animation-only-1";
const NEUTRAL_FACE_URL = "/style-references/avatar/yuyang-avatar-neutral-face-approved.png?v=20260822-approved";
const BLINK_FACE_URL = "/style-references/avatar/yuyang-avatar-neutral-face-blink-closed.png?v=20260822-closed-eyes";
const TALKING_MOUTH_URLS = [0, 1, 2, 3].map(
  (index) => `/style-references/avatar/yuyang-avatar-talking-mouth-${index}.png?v=20260822-independent-mouth`,
);

const TALKING_MOUTH_SEQUENCE = [1, 2, 3, 1, null, 2, 1, 3] as const;
const TALKING_MOUTH_STEP_SECONDS = 0.08;
const WAVE_MOVING_ARM_BONE = /Left(?:Shoulder|Arm|ForeArm|Hand|Thumb\d*|Index\d*|Middle\d*|Ring\d*|Pinky\d*)/;
const HEAD_AND_NECK_BONES = /(?:Head|neck)/;

function configureFaceTexture(texture: THREE.Texture) {
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.flipY = false;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
}

async function loadIdleAvatar(onWaveComplete?: () => void): Promise<AvatarAnimationSource> {
  const loader = new GLTFLoader();
  const [gltf, waveGltf, nodGltf, shakeGltf] = await Promise.all([
    loader.loadAsync(IDLE_MODEL_URL),
    loader.loadAsync(WAVE_MODEL_URL),
    loader.loadAsync(NOD_MODEL_URL),
    loader.loadAsync(SHAKE_MODEL_URL),
  ]);
  const idleClip = gltf.animations.find((clip) => clip.name === "Idle_Loop");
  if (!idleClip) throw new Error("Embedded avatar GLB is missing Idle_Loop");
  const sourceWaveClip = waveGltf.animations.find((clip) => clip.name === "wave_hello");
  if (!sourceWaveClip) throw new Error("Wave avatar GLB is missing wave_hello");
  const sourceNodClip = nodGltf.animations.find((clip) => clip.name === "nod_smile");
  if (!sourceNodClip) throw new Error("Nod avatar GLB is missing nod_smile");
  const sourceShakeClip = shakeGltf.animations.find((clip) => clip.name === "head_shake_disappointed");
  if (!sourceShakeClip) throw new Error("Head-shake avatar GLB is missing head_shake_disappointed");

  const mixer = new THREE.AnimationMixer(gltf.scene);
  mixer.timeScale = 0;
  mixer.update(0);

  for (const sourceGltf of [waveGltf, nodGltf, shakeGltf]) {
    sourceGltf.scene.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      object.geometry.dispose();
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      materials.forEach((material) => material.dispose());
    });
  }

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
  let activeEmote: AvatarEmote | null = null;
  let activeState = "";
  const drawFace = (eyesClosed: boolean, mouth: number | null, expression: "neutral" | "smile" | "disappointed" = "neutral") => {
    const key = `${expression}-${eyesClosed ? "closed" : "open"}-${mouth ?? "neutral"}`;
    if (activeState === key) return;
    context.clearRect(0, 0, 512, 512);
    context.drawImage((eyesClosed ? blinkTexture : neutralTexture).image as CanvasImageSource, 0, 0, 512, 512);
    if (expression === "smile") {
      context.clearRect(170, 350, 172, 126);
      context.fillStyle = "#a96861";
      context.beginPath();
      context.moveTo(198, 383); context.quadraticCurveTo(256, 375, 314, 383);
      context.quadraticCurveTo(304, 454, 256, 458); context.quadraticCurveTo(208, 454, 198, 383);
      context.closePath(); context.fill();
      context.fillStyle = "#fff5e8";
      context.beginPath();
      context.moveTo(207, 388); context.quadraticCurveTo(256, 382, 305, 388);
      context.lineTo(297, 411); context.quadraticCurveTo(256, 416, 215, 411);
      context.closePath(); context.fill();
      context.fillStyle = "#e99086";
      context.beginPath();
      context.moveTo(218, 432); context.quadraticCurveTo(256, 419, 294, 432);
      context.quadraticCurveTo(279, 450, 256, 452); context.quadraticCurveTo(233, 450, 218, 432);
      context.closePath(); context.fill();
    } else if (expression === "disappointed") {
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
      context.moveTo(204, 414); context.quadraticCurveTo(256, 386, 308, 414);
      context.quadraticCurveTo(256, 397, 204, 414); context.closePath(); context.fill();
    } else if (mouth !== null) {
      context.clearRect(165, 350, 185, 126);
      context.drawImage(talkingMouthTextures[mouth].image as CanvasImageSource, 0, 0, 512, 512);
    }
    animatedFaceTexture.needsUpdate = true;
    activeState = key;
  };

  const emotePlayer = createAvatarEmotePlayer(mixer, idleClip, {
    wave_hello: { clip: sourceWaveClip, movingBonePattern: WAVE_MOVING_ARM_BONE, playbackRate: 1.3 },
    nod_smile: { clip: sourceNodClip, movingBonePattern: HEAD_AND_NECK_BONES },
    head_shake_disappointed: { clip: sourceShakeClip, movingBonePattern: HEAD_AND_NECK_BONES },
  }, (emote) => {
    activeEmote = emote;
    activeState = "";
  });
  const handleEmoteRequest = (event: Event) => {
    const request = (event as CustomEvent<AvatarEmoteRequestDetail>).detail;
    if (!request || !emotePlayer.play(request.emote, request.complete)) return;
    request.accept();
  };
  window.addEventListener(AVATAR_EMOTE_REQUEST_EVENT, handleEmoteRequest);

  return {
    root: gltf.scene,
    mixer,
    start: () => {
      emotePlayer.play("wave_hello", onWaveComplete);
    },
    update: (elapsedSeconds, talking) => {
      const blinkClock = elapsedSeconds % 5;
      const eyesClosed = (blinkClock >= 2.15 && blinkClock < 2.27) || (blinkClock >= 4.35 && blinkClock < 4.47);

      if (activeEmote === "nod_smile") {
        drawFace(false, null, "smile");
        return;
      }
      if (activeEmote === "head_shake_disappointed") {
        drawFace(false, null, "disappointed");
        return;
      }

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
      window.removeEventListener(AVATAR_EMOTE_REQUEST_EVENT, handleEmoteRequest);
      emotePlayer.dispose();
    },
  };
}

export default function AvatarIdle({ onReady, onWaveComplete, talking = false }: { onReady?: () => void; onWaveComplete?: () => void; talking?: boolean }) {
  const loadAvatar = useCallback(() => loadIdleAvatar(onWaveComplete), [onWaveComplete]);
  return (
    <AvatarFullscreen
      ariaLabel="Smiling Yuyang avatar idling"
      loadAvatar={loadAvatar}
      loadErrorMessage="[AvatarCall] Could not load idle avatar"
      onReady={onReady}
      talking={talking}
    />
  );
}
