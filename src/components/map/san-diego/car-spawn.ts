import * as THREE from "three";
import { SAN_DIEGO_CARS } from "../../../generated/san-diego-car-spawns";
import { createCarInstances } from "../shared/street-life";

/** San Diego uses the NYC car mesh with its own ordinary-car palette and routes. */
export function createSanDiegoCars(group: THREE.Object3D, isVisible: () => boolean, revealAt: () => number) {
  return createCarInstances(group, SAN_DIEGO_CARS.traffic, revealAt, isVisible,
    [0x45535f, 0xf1ede2, 0x895b50, 0x6f8078, 0x747b8d], "San Diego ordinary cars · no taxis");
}
