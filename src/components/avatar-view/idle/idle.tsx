"use client";

import { useCallback } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import AvatarFullscreen, { type AvatarAnimationSource } from "../avatar-fullscreen";

const IDLE_MODEL_URL = "/animations/idle.glb?v=20260822-user-approved-manual-face-fit";
const WAVE_MODEL_URL = "/animations/wave-hello-review-v2.glb?v=20260822-open-hand-wave";
const NEUTRAL_FACE_URL = "/style-references/avatar/yuyang-avatar-neutral-face-approved.png?v=20260822-approved";
const BLINK_FACE_URL = "/style-references/avatar/yuyang-avatar-neutral-face-blink-closed.png?v=20260822-closed-eyes";
const TALKING_MOUTH_URLS = [0, 1, 2, 3].map(
  (index) => `/style-references/avatar/yuyang-avatar-talking-mouth-${index}.png?v=20260822-independent-mouth`,
);

const TALKING_MOUTH_SEQUENCE = [1, 2, 3, 1, null, 2, 1, 3] as const;
const TALKING_MOUTH_STEP_SECONDS = 0.08;
const WAVE_ARM_BONE = /(?:Left|Right)(?:Shoulder|Arm|ForeArm|Hand|Thumb\d*|Index\d*|Middle\d*|Ring\d*|Pinky\d*)/;

function createIntroWaveClip(source: THREE.AnimationClip, idle: THREE.AnimationClip) {
  const idleTracks = new Map(idle.tracks.map((track) => [track.name, track]));
  const tracks = source.tracks.map((sourceTrack) => {
    const track = sourceTrack.clone();
    const idleTrack = idleTracks.get(track.name);
    const valueSize = track.getValueSize();
    const idleValues = idleTrack?.values.slice(0, valueSize) ?? track.values.slice(0, valueSize);
    const keepsWaveRotation = track.name.endsWith(".quaternion") && WAVE_ARM_BONE.test(track.name);

    if (!keepsWaveRotation) {
      for (let offset = 0; offset < track.values.length; offset += valueSize) {
        track.values.set(idleValues, offset);
      }
      return track;
    }

    track.values.set(idleValues, 0);
    track.values.set(idleValues, track.values.length - valueSize);
    return track;
  });
  return new THREE.AnimationClip("wave_hello_intro", source.duration, tracks);
}

function configureFaceTexture(texture: THREE.Texture) {
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.flipY = false;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
}

async function loadIdleAvatar(onWaveComplete?: () => void): Promise<AvatarAnimationSource> {
  const loader = new GLTFLoader();
  const [gltf, waveGltf] = await Promise.all([
    loader.loadAsync(IDLE_MODEL_URL),
    loader.loadAsync(WAVE_MODEL_URL),
  ]);
  const idleClip = gltf.animations.find((clip) => clip.name === "Idle_Loop");
  if (!idleClip) throw new Error("Embedded avatar GLB is missing Idle_Loop");
  const sourceWaveClip = waveGltf.animations.find((clip) => clip.name === "wave_hello");
  if (!sourceWaveClip) throw new Error("Wave avatar GLB is missing wave_hello");
  const waveClip = createIntroWaveClip(sourceWaveClip, idleClip);

  const mixer = new THREE.AnimationMixer(gltf.scene);
  const idleAction = mixer.clipAction(idleClip);
  const waveAction = mixer.clipAction(waveClip);
  waveAction.setLoop(THREE.LoopOnce, 1);
  waveAction.clampWhenFinished = true;
  mixer.timeScale = 0;
  mixer.update(0);

  waveGltf.scene.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    object.geometry.dispose();
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    materials.forEach((material) => material.dispose());
  });

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
  const handleWaveFinished = (event: { action: THREE.AnimationAction }) => {
    if (event.action !== waveAction) return;
    mixer.removeEventListener("finished", handleWaveFinished);
    waveAction.stop();
    idleAction.reset().play();
    onWaveComplete?.();
  };
  mixer.addEventListener("finished", handleWaveFinished);
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
    start: () => {
      waveAction.reset().play();
      mixer.timeScale = 1;
    },
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
      mixer.removeEventListener("finished", handleWaveFinished);
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
