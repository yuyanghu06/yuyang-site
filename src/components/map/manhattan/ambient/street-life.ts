import * as THREE from "three";
import { AMBIENT_LAYOUT } from "../../../../generated/ambient-layout";
import { type AmbientAnimation } from "../../shared/core";
import { createCarInstances, createPedestrianInstances } from "../../shared/street-life";
export { populationScale } from "../../shared/street-life";

export function pointInRing(x: number, z: number, ring: Array<[number, number]>) {
  let inside = false;
  for (let current = 0, previous = ring.length - 1; current < ring.length; previous = current, current += 1) {
    const [currentX, currentZ] = ring[current];
    const [previousX, previousZ] = ring[previous];
    if (((currentZ > z) !== (previousZ > z))
      && x < ((previousX - currentX) * (z - currentZ)) / (previousZ - currentZ) + currentX) {
      inside = !inside;
    }
  }
  return inside;
}

export function createPedestrians(scene: THREE.Scene, isVisible: () => boolean, revealAt: () => number): AmbientAnimation {
  return createPedestrianInstances(scene, AMBIENT_LAYOUT.pedestrians, isVisible, revealAt);
}

export function createTraffic(scene: THREE.Scene, revealAt: () => number, isVisible: () => boolean = () => true): AmbientAnimation {
  return createCarInstances(scene, AMBIENT_LAYOUT.traffic, revealAt, isVisible,
    [0x45535f, 0xf1ede2, 0xf2b71d, 0xf1ede2, 0x45535f, 0xf2b71d], "road-verified low-detail cars with every third car a yellow taxi");
}
