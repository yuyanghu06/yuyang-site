import * as THREE from "three";
import { SAN_DIEGO_PEOPLE } from "../../../generated/san-diego-people-spawns";
import { SAN_DIEGO_CARS } from "../../../generated/san-diego-car-spawns";
import { createPedestrianInstances } from "../shared/street-life";
import { createSanDiegoCars } from "./car-spawn";

export function validateSanDiegoPopulation(modelHash: string) {
  if (SAN_DIEGO_PEOPLE.provenance.modelHash !== modelHash || SAN_DIEGO_CARS.provenance.modelHash !== modelHash) {
    throw new Error("San Diego population is stale. Regenerate its separate people and car spawn layouts after the model.");
  }
}

/** Four instanced meshes, mounted once with the loaded city, disposed with its scene. */
export function createSanDiegoPopulation(group: THREE.Object3D, isVisible: () => boolean, revealAt: () => number) {
  return [
    createPedestrianInstances(group, SAN_DIEGO_PEOPLE.pedestrians, isVisible, () => revealAt() + 350),
    createSanDiegoCars(group, isVisible, () => revealAt() + 150),
  ];
}
