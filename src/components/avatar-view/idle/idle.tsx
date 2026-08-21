"use client";

import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import AvatarFullscreen, { type AvatarAnimationSource } from "../avatar-fullscreen";
import { createFixedBodyAnimationClip } from "../fixed-body-animation";

const IDLE_MODEL_URL = "/models/yuyang-avatar-idle-loop-v2.glb";

async function loadIdleAvatar(): Promise<AvatarAnimationSource> {
  const gltf = await new GLTFLoader().loadAsync(IDLE_MODEL_URL);
  if (gltf.animations.length === 0) return { root: gltf.scene, mixer: null };

  const mixer = new THREE.AnimationMixer(gltf.scene);
  mixer.clipAction(createFixedBodyAnimationClip(gltf.animations[0])).play();
  mixer.update(0);
  return { root: gltf.scene, mixer };
}

export default function AvatarIdle() {
  return (
    <AvatarFullscreen
      ariaLabel="Smiling Yuyang avatar idling"
      loadAvatar={loadIdleAvatar}
      loadErrorMessage="[AvatarCall] Could not load idle avatar"
    />
  );
}
