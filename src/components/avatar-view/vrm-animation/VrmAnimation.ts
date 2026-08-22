import * as THREE from "three";
import {
  VRMHumanBoneParentMap,
  type VRM,
  type VRMHumanBoneName,
} from "@pixiv/three-vrm";
import {
  restPoseClipName,
  sourceBoneToHumanBone,
} from "./VrmAnimationContract";
import {
  createTargetRestPoseMap,
  getTargetSceneRotation,
  type TargetRestPose,
} from "./VrmTargetRestPose";

const sourceHipsBoneName = getSourceBoneName("hips");

interface RetargetTarget {
  node: THREE.Object3D;
  rawNode: THREE.Object3D;
  trackName: string;
  humanBoneName: VRMHumanBoneName;
}

interface SourceRestPose {
  hasRootQuaternion: boolean;
  positions: Map<string, THREE.Vector3>;
  quaternions: Map<string, THREE.Quaternion>;
  rootQuaternion: THREE.Quaternion;
}

interface SourceBone {
  sourceName: string;
  humanBoneName: VRMHumanBoneName;
  parentSourceName: string | null;
}

interface RetargetContext {
  restPose: SourceRestPose;
  sourceBones: SourceBone[];
  sourceRestWorld: Map<string, THREE.Quaternion>;
  targetMap: Map<string, RetargetTarget>;
  targetRestPose: TargetRestPose;
  targetSceneRotation: THREE.Quaternion;
  targetSceneRotationInverse: THREE.Quaternion;
}

export function retargetHumanoidAnimationClips(
  clips: THREE.AnimationClip[],
  vrm: VRM,
  clipNames: readonly string[],
  options: { mirrorArmMotion?: boolean; swapArmMotion?: boolean; reflectArmMotion?: boolean } = {}
) {
  const targetMap = createTargetMap(vrm);
  const restPose = createSourceRestPoseMap(clips);
  assertCompleteSourceRestPose(restPose);
  const sourceBones = createSourceBoneOrder(targetMap, restPose);
  const targetSceneRotation = getTargetSceneRotation(vrm);
  const context: RetargetContext = {
    restPose,
    sourceBones,
    sourceRestWorld: createSourceRestWorldMap(sourceBones, restPose),
    targetMap,
    targetRestPose: createTargetRestPoseMap(vrm, sourceBones, targetMap),
    targetSceneRotation,
    targetSceneRotationInverse: targetSceneRotation.clone().invert(),
  };
  const selectedClipNames = new Set(clipNames);
  return clips
    .filter((clip) => selectedClipNames.has(clip.name))
    .map((clip) => retargetHumanoidAnimationClip(clip, context, options));
}

function retargetHumanoidAnimationClip(
  clip: THREE.AnimationClip,
  context: RetargetContext,
  options: { mirrorArmMotion?: boolean; swapArmMotion?: boolean; reflectArmMotion?: boolean }
) {
  const tracks = retargetQuaternionTracks(clip, context, options);
  for (const track of clip.tracks) {
    const retargeted = retargetPositionTrack(
      track,
      context.targetMap,
      context.restPose,
      context.targetSceneRotationInverse
    );
    if (retargeted) tracks.push(retargeted);
  }
  if (tracks.length === 0) {
    throw new Error(`Animation clip has no humanoid tracks: ${clip.name}`);
  }
  return new THREE.AnimationClip(clip.name, clip.duration, tracks);
}

function retargetPositionTrack(
  track: THREE.KeyframeTrack,
  targetMap: Map<string, RetargetTarget>,
  restPose: SourceRestPose,
  targetSceneRotationInverse: THREE.Quaternion
) {
  const parsed = THREE.PropertyBinding.parseTrackName(track.name);
  if (
    parsed.propertyName === "position" &&
    parsed.nodeName === sourceHipsBoneName
  ) {
    return retargetHipsPositionTrack(
      track,
      parsed.nodeName,
      targetMap,
      restPose,
      targetSceneRotationInverse
    );
  }
  return null;
}

function retargetQuaternionTracks(
  clip: THREE.AnimationClip,
  context: RetargetContext,
  options: { mirrorArmMotion?: boolean; swapArmMotion?: boolean; reflectArmMotion?: boolean }
) {
  const trackMap = createQuaternionTrackMap(clip, context.targetMap);
  if (trackMap.size === 0) return [];

  const firstTrack = trackMap.values().next().value;
  if (!firstTrack) return [];

  for (const track of trackMap.values()) {
    if (!hasSameTimes(track.times, firstTrack.times)) {
      throw new Error(
        `Animation clip has mismatched humanoid track times: ${clip.name}`
      );
    }
  }

  const rootTrack = findRootQuaternionTrack(clip);
  if (rootTrack && !hasSameTimes(rootTrack.times, firstTrack.times)) {
    throw new Error(`Animation clip has mismatched root track times: ${clip.name}`);
  }
  if (rootTrack) {
    assertStableRootQuaternionTrack(rootTrack, context.restPose, clip.name);
  }

  assertCompleteQuaternionTracks(clip.name, context.sourceBones, trackMap);
  const sourceFrameWorld = createQuaternionMap(context.sourceBones);
  const targetFrameWorld = createQuaternionMap(context.sourceBones);
  const outputValues = new Map<string, Float32Array>();
  for (const sourceBone of context.sourceBones) {
    outputValues.set(
      sourceBone.sourceName,
      new Float32Array(firstTrack.values.length)
    );
  }

  const frameRootQuaternion = new THREE.Quaternion();
  const frameLocal = new THREE.Quaternion();
  const sourceDeltaWorld = new THREE.Quaternion();
  const sourceRestInverse = new THREE.Quaternion();
  const targetFrameLocal = new THREE.Quaternion();
  const targetNormalized = new THREE.Quaternion();
  const targetParentFrameInverse = new THREE.Quaternion();
  const targetRawLocalInverse = new THREE.Quaternion();
  const targetParentRestInverse = new THREE.Quaternion();
  const reflection = new THREE.Matrix4().makeScale(-1, 1, 1);
  const deltaMatrix = new THREE.Matrix4();
  const mirroredMatrix = new THREE.Matrix4();

  for (let frame = 0; frame < firstTrack.times.length; frame += 1) {
    if (rootTrack) {
      frameRootQuaternion.fromArray(rootTrack.values, frame * 4);
    } else {
      frameRootQuaternion.copy(context.restPose.rootQuaternion);
    }
    for (const sourceBone of context.sourceBones) {
      const sourceParentFrameWorld = sourceBone.parentSourceName
        ? sourceFrameWorld.get(sourceBone.parentSourceName)
        : frameRootQuaternion;
      const sourceTrack = trackMap.get(sourceBone.sourceName)!;
      frameLocal.fromArray(sourceTrack.values, frame * 4);
      sourceFrameWorld
        .get(sourceBone.sourceName)!
        .copy(sourceParentFrameWorld ?? frameRootQuaternion)
        .multiply(frameLocal);
    }

    for (const sourceBone of context.sourceBones) {
      const swappedSourceName = options.mirrorArmMotion || options.swapArmMotion
        ? oppositeArmSourceName(sourceBone.sourceName)
        : null;
      const motionSourceName = swappedSourceName ?? sourceBone.sourceName;
      const motionFrameWorld = sourceFrameWorld.get(motionSourceName)!;
      const motionRestWorld = context.sourceRestWorld.get(motionSourceName)!;

      sourceDeltaWorld
        .copy(motionFrameWorld)
        .multiply(sourceRestInverse.copy(motionRestWorld).invert());
      if ((swappedSourceName && options.mirrorArmMotion) || (!swappedSourceName && options.reflectArmMotion && isArmSourceName(sourceBone.sourceName))) {
        deltaMatrix.makeRotationFromQuaternion(sourceDeltaWorld);
        mirroredMatrix
          .copy(reflection)
          .multiply(deltaMatrix)
          .multiply(reflection);
        sourceDeltaWorld.setFromRotationMatrix(mirroredMatrix).normalize();
      }
      sourceDeltaWorld
        .premultiply(context.targetSceneRotationInverse)
        .multiply(context.targetSceneRotation);

      const targetRestWorld = context.targetRestPose.rawWorld.get(sourceBone.sourceName)!;
      const targetParentRestWorld = context.targetRestPose.parentRawWorld.get(sourceBone.sourceName)!;
      const targetRawRestLocal = context.targetRestPose.rawLocal.get(sourceBone.sourceName)!;
      const targetParentFrameWorld = sourceBone.parentSourceName
        ? targetFrameWorld.get(sourceBone.parentSourceName)!
        : targetParentRestWorld;
      const targetWorld = targetFrameWorld
        .get(sourceBone.sourceName)!
        .copy(sourceDeltaWorld)
        .multiply(targetRestWorld);
      targetFrameLocal.copy(targetParentFrameInverse.copy(targetParentFrameWorld).invert()).multiply(targetWorld);
      targetNormalized
        .copy(targetParentRestWorld)
        .multiply(targetFrameLocal)
        .multiply(targetRawLocalInverse.copy(targetRawRestLocal).invert())
        .multiply(targetParentRestInverse.copy(targetParentRestWorld).invert())
        .toArray(outputValues.get(sourceBone.sourceName)!, frame * 4);
    }
  }

  const retargetedTracks: THREE.KeyframeTrack[] = [];
  for (const [sourceName, values] of outputValues) {
    const target = context.targetMap.get(sourceName);
    const sourceTrack = trackMap.get(sourceName)!;
    if (!target) continue;
    const track = new THREE.QuaternionKeyframeTrack(
      `${target.trackName}.quaternion`,
      firstTrack.times,
      values
    );
    track.setInterpolation(sourceTrack.getInterpolation());
    retargetedTracks.push(track);
  }
  return retargetedTracks;
}

function oppositeArmSourceName(sourceName: string) {
  if (!isArmSourceName(sourceName)) return null;
  if (sourceName.endsWith("L")) return `${sourceName.slice(0, -1)}R`;
  if (sourceName.endsWith("R")) return `${sourceName.slice(0, -1)}L`;
  return null;
}

function isArmSourceName(sourceName: string) {
  return /^(DEF-(shoulder|upper_arm|forearm|hand|thumb\d+|f_(index|middle|ring|pinky)\d+))[LR]$/.test(
    sourceName
  );
}

function retargetHipsPositionTrack(
  track: THREE.KeyframeTrack,
  sourceName: string,
  targetMap: Map<string, RetargetTarget>,
  restPose: SourceRestPose,
  targetSceneRotationInverse: THREE.Quaternion
) {
  const target = targetMap.get(sourceName);
  const sourceRestPosition = restPose.positions.get(sourceName);
  if (!target || !sourceRestPosition) return null;

  const values = new Float32Array(track.values.length);
  const framePosition = new THREE.Vector3();
  const sourceDelta = new THREE.Vector3();
  for (let i = 0; i < track.values.length; i += 3) {
    sourceDelta
      .fromArray(track.values, i)
      .sub(sourceRestPosition)
      .applyQuaternion(restPose.rootQuaternion)
      .applyQuaternion(targetSceneRotationInverse);
    framePosition.copy(target.node.position).add(sourceDelta).toArray(values, i);
  }

  const retargeted = new THREE.VectorKeyframeTrack(
    `${target.trackName}.position`,
    track.times,
    values
  );
  retargeted.setInterpolation(track.getInterpolation());
  return retargeted;
}

function createTargetMap(vrm: VRM) {
  const targetMap = new Map<string, RetargetTarget>();
  const missingTargets: string[] = [];
  for (const [sourceName, humanBoneName] of Object.entries(sourceBoneToHumanBone)) {
    const node = vrm.humanoid.getNormalizedBoneNode(humanBoneName);
    const rawNode = vrm.humanoid.getRawBoneNode(humanBoneName);
    if (!node || !rawNode) {
      missingTargets.push(`${sourceName} (${humanBoneName})`);
      continue;
    }
    targetMap.set(sourceName, { humanBoneName, node, rawNode, trackName: node.uuid });
  }
  if (missingTargets.length > 0) {
    throw new Error(
      `Character VRM is missing required humanoid bones: ${missingTargets.join(", ")}`
    );
  }
  return targetMap;
}

function getSourceBoneName(humanBoneName: VRMHumanBoneName) {
  for (const [sourceName, mappedHumanBoneName] of Object.entries(
    sourceBoneToHumanBone
  )) {
    if (mappedHumanBoneName === humanBoneName) return sourceName;
  }
  throw new Error(`Missing source bone mapping for VRM human bone: ${humanBoneName}`);
}

function createQuaternionTrackMap(
  clip: THREE.AnimationClip,
  targetMap: Map<string, RetargetTarget>
) {
  const trackMap = new Map<string, THREE.KeyframeTrack>();
  for (const track of clip.tracks) {
    const parsed = THREE.PropertyBinding.parseTrackName(track.name);
    if (
      parsed.nodeName &&
      parsed.propertyName === "quaternion" &&
      targetMap.has(parsed.nodeName)
    ) {
      trackMap.set(parsed.nodeName, track);
    }
  }
  return trackMap;
}

function findRootQuaternionTrack(clip: THREE.AnimationClip) {
  for (const track of clip.tracks) {
    const parsed = THREE.PropertyBinding.parseTrackName(track.name);
    if (parsed.nodeName === "root" && parsed.propertyName === "quaternion") {
      return track;
    }
  }
  return null;
}

function createSourceBoneOrder(
  targetMap: Map<string, RetargetTarget>,
  restPose: SourceRestPose
) {
  const sourceNameByHumanBone = new Map<VRMHumanBoneName, string>();
  for (const [sourceName, humanBoneName] of Object.entries(sourceBoneToHumanBone)) {
    sourceNameByHumanBone.set(humanBoneName, sourceName);
  }

  const sourceBones: SourceBone[] = [];
  for (const [sourceName, target] of targetMap) {
    if (!restPose.quaternions.has(sourceName)) continue;
    const parentSourceName = resolveParentSourceName(
      target.humanBoneName,
      sourceNameByHumanBone,
      targetMap,
      restPose
    );
    sourceBones.push({
      humanBoneName: target.humanBoneName,
      parentSourceName,
      sourceName,
    });
  }

  return sourceBones.sort(
    (a, b) => getHumanBoneDepth(a.humanBoneName) - getHumanBoneDepth(b.humanBoneName)
  );
}

function createQuaternionMap(sourceBones: SourceBone[]) {
  const map = new Map<string, THREE.Quaternion>();
  for (const sourceBone of sourceBones) {
    map.set(sourceBone.sourceName, new THREE.Quaternion());
  }
  return map;
}

function createSourceRestWorldMap(
  sourceBones: SourceBone[],
  restPose: SourceRestPose
) {
  const restWorld = new Map<string, THREE.Quaternion>();
  for (const sourceBone of sourceBones) {
    const restLocal = restPose.quaternions.get(sourceBone.sourceName);
    if (!restLocal) continue;
    const parentWorld = sourceBone.parentSourceName
      ? restWorld.get(sourceBone.parentSourceName)
      : restPose.rootQuaternion;
    const world = new THREE.Quaternion()
      .copy(parentWorld ?? restPose.rootQuaternion)
      .multiply(restLocal);
    restWorld.set(sourceBone.sourceName, world);
  }
  return restWorld;
}

function resolveParentSourceName(
  humanBoneName: VRMHumanBoneName,
  sourceNameByHumanBone: Map<VRMHumanBoneName, string>,
  targetMap: Map<string, RetargetTarget>,
  restPose: SourceRestPose
) {
  let parent = VRMHumanBoneParentMap[humanBoneName];
  while (parent) {
    const sourceName = sourceNameByHumanBone.get(parent);
    if (
      sourceName &&
      targetMap.has(sourceName) &&
      restPose.quaternions.has(sourceName)
    ) {
      return sourceName;
    }
    parent = VRMHumanBoneParentMap[parent];
  }
  return null;
}

function getHumanBoneDepth(humanBoneName: VRMHumanBoneName) {
  let depth = 0;
  let parent = VRMHumanBoneParentMap[humanBoneName];
  while (parent) {
    depth += 1;
    parent = VRMHumanBoneParentMap[parent];
  }
  return depth;
}

function hasSameTimes(a: THREE.TypedArray, b: THREE.TypedArray) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function assertCompleteQuaternionTracks(
  clipName: string,
  sourceBones: SourceBone[],
  trackMap: Map<string, THREE.KeyframeTrack>
) {
  const missingSourceNames = sourceBones
    .filter((sourceBone) => !trackMap.has(sourceBone.sourceName))
    .map((sourceBone) => sourceBone.sourceName);
  if (missingSourceNames.length > 0) {
    throw new Error(
      `Animation clip is missing humanoid quaternion tracks: ${clipName}: ${missingSourceNames.join(", ")}`
    );
  }
}

function assertCompleteSourceRestPose(restPose: SourceRestPose) {
  if (!restPose.hasRootQuaternion) {
    throw new Error(`Missing rest pose root quaternion: ${restPoseClipName}`);
  }

  const missingSourceNames = Object.keys(sourceBoneToHumanBone).filter(
    (sourceName) => !restPose.quaternions.has(sourceName)
  );
  if (missingSourceNames.length > 0) {
    throw new Error(
      `Rest pose is missing humanoid quaternion tracks: ${restPoseClipName}: ${missingSourceNames.join(", ")}`
    );
  }
}

function assertStableRootQuaternionTrack(
  track: THREE.KeyframeTrack,
  restPose: SourceRestPose,
  clipName: string
) {
  const frameQuaternion = new THREE.Quaternion();
  frameQuaternion.fromArray(track.values, 0);
  if (!frameQuaternion.equals(restPose.rootQuaternion)) {
    throw new Error(`Animation clip has a non-rest root quaternion: ${clipName}`);
  }
  for (let i = 4; i < track.values.length; i += 4) {
    frameQuaternion.fromArray(track.values, i);
    if (!frameQuaternion.equals(restPose.rootQuaternion)) {
      throw new Error(`Animation clip has animated root rotation: ${clipName}`);
    }
  }
}

function createSourceRestPoseMap(clips: THREE.AnimationClip[]) {
  const clip = clips.find((item) => item.name === restPoseClipName);
  if (!clip) throw new Error(`Missing rest pose clip: ${restPoseClipName}`);

  const restPose: SourceRestPose = {
    hasRootQuaternion: false,
    positions: new Map(),
    quaternions: new Map(),
    rootQuaternion: new THREE.Quaternion(),
  };
  for (const track of clip.tracks) {
    const parsed = THREE.PropertyBinding.parseTrackName(track.name);
    if (parsed.nodeName === "root" && parsed.propertyName === "quaternion") {
      restPose.hasRootQuaternion = true;
      restPose.rootQuaternion.fromArray(track.values, 0);
      continue;
    }
    if (
      !parsed.nodeName ||
      !(parsed.nodeName in sourceBoneToHumanBone)
    ) {
      continue;
    }
    if (parsed.propertyName === "quaternion") {
      restPose.quaternions.set(
        parsed.nodeName,
        new THREE.Quaternion().fromArray(track.values, 0)
      );
    }
    if (parsed.propertyName === "position") {
      restPose.positions.set(
        parsed.nodeName,
        new THREE.Vector3().fromArray(track.values, 0)
      );
    }
  }
  return restPose;
}
