import * as THREE from "three";

const MOVING_BONE_NAMES = [
  "neck",
  "Head",
  "LeftShoulder",
  "LeftArm",
  "LeftForeArm",
  "LeftHand",
  "LeftThumb",
  "LeftIndex",
  "LeftMiddle",
  "LeftRing",
  "LeftPinky",
  "RightShoulder",
  "RightArm",
  "RightForeArm",
  "RightHand",
  "RightThumb",
  "RightIndex",
  "RightMiddle",
  "RightRing",
  "RightPinky",
] as const;

/**
 * Creates a reusable avatar clip with the root, legs, hips, and torso locked.
 * Only the head/neck and complete arm, hand, and finger chains retain motion.
 */
export function createFixedBodyAnimationClip(source: THREE.AnimationClip) {
  const tracks = source.tracks.filter((track) =>
    MOVING_BONE_NAMES.some((boneName) => track.name.includes(boneName)),
  );

  return new THREE.AnimationClip(`${source.name}_FixedBody`, source.duration, tracks);
}
