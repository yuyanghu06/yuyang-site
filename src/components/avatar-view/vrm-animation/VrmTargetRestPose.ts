import * as THREE from "three";
import type { VRM } from "@pixiv/three-vrm";
import { isVrm0 } from "./VrmMeta";

interface RestPoseSourceBone {
  sourceName: string;
}

interface RestPoseTarget {
  rawNode: THREE.Object3D;
}

export interface TargetRestPose {
  parentRawWorld: Map<string, THREE.Quaternion>;
  rawLocal: Map<string, THREE.Quaternion>;
  rawWorld: Map<string, THREE.Quaternion>;
}

export function getTargetSceneRotation(vrm: VRM) {
  if (!isVrm0(vrm)) return new THREE.Quaternion();
  return vrm.scene.quaternion.clone();
}

export function createTargetRestPoseMap(
  vrm: VRM,
  sourceBones: RestPoseSourceBone[],
  targetMap: Map<string, RestPoseTarget>
) {
  const restoreSceneRotation = neutralizeVrm0SceneRotation(vrm);
  const restPose: TargetRestPose = {
    parentRawWorld: new Map(),
    rawLocal: new Map(),
    rawWorld: new Map(),
  };
  const position = new THREE.Vector3();
  const rotation = new THREE.Quaternion();
  const scale = new THREE.Vector3();

  try {
    for (const sourceBone of sourceBones) {
      const rawNode = targetMap.get(sourceBone.sourceName)!.rawNode;
      rawNode.matrixWorld.decompose(position, rotation, scale);
      restPose.rawLocal.set(sourceBone.sourceName, rawNode.quaternion.clone());
      restPose.rawWorld.set(sourceBone.sourceName, rotation.clone());
      if (rawNode.parent) {
        rawNode.parent.matrixWorld.decompose(position, rotation, scale);
        restPose.parentRawWorld.set(sourceBone.sourceName, rotation.clone());
      } else {
        restPose.parentRawWorld.set(sourceBone.sourceName, new THREE.Quaternion());
      }
    }
  } finally {
    restoreSceneRotation();
  }

  return restPose;
}

function neutralizeVrm0SceneRotation(vrm: VRM) {
  const sceneRotationY = vrm.scene.rotation.y;
  if (isVrm0(vrm)) vrm.scene.rotation.y = 0;
  vrm.scene.updateWorldMatrix(true, true);
  return () => {
    vrm.scene.rotation.y = sceneRotationY;
    vrm.scene.updateWorldMatrix(true, true);
  };
}
