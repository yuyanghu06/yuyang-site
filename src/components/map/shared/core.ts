import * as THREE from "three";

export type Point3 = [number, number, number];
export type SurfaceKind = "ground" | "roof" | "wall";

export interface CityGmlSurface {
  kind: SurfaceKind;
  ring: Point3[];
  holes: Point3[][];
  color?: THREE.Color;
}

export interface WashingtonCityRuntimeData {
  footprints: Array<Array<[number, number]>>;
  details: Record<string, CityGmlSurface[]>;
}

export interface WashingtonCityManifest {
  version: string;
  tileSize: number;
  buildingCount: number;
  tiles: Array<{ file: string; x: number; z: number }>;
}

export interface WashingtonPlanimetricsData {
  roadbeds: Array<{
    ring: Array<[number, number]>;
    holes: Array<Array<[number, number]>>;
  }>;
}

export interface WashingtonParkData {
  paths: Array<{
    sourceId: string;
    kind: "footway" | "path" | "pedestrian";
    width: number;
    points: Array<[number, number]>;
  }>;
  crossings: Array<{ sourceId: string; point: [number, number]; angle: number; span: number }>;
  fountain: { sourceId: string; ring: Array<[number, number]> } | null;
  arch: { sourceId: string; height: number; footprint: Array<[number, number]> } | null;
  parkRings?: Array<Array<[number, number]>>;
}

export const SHARED_DATA_VERSION = "2026-08-20-manhattan-roads-2600-v1";

export function isAbortError(error: unknown) {
  return typeof error === "object" && error !== null && "name" in error && error.name === "AbortError";
}

export function createLoadLogger(prefix: string) {
  const startedAt = performance.now();
  const log = (stage: string, details: Record<string, unknown> = {}) => {
    console.info(prefix, stage, {
      elapsedMs: Math.round(performance.now() - startedAt),
      ...details,
    });
  };
  return Object.assign(log, {
    start(stage: string, details: Record<string, unknown> = {}) {
      const stageStartedAt = performance.now();
      log(`${stage} start`, details);
      return (endDetails: Record<string, unknown> = {}) => {
        log(`${stage} end`, {
          stageDurationMs: Math.round(performance.now() - stageStartedAt),
          ...endDetails,
        });
      };
    },
  });
}

export interface SkyTraveler {
  group: THREE.Group;
  view: "manhattan" | "neighborhood";
  axis?: "x" | "z";
  speed: number;
  phase: number;
  startX: number;
  endX: number;
  baseY: number;
  bobAmount?: number;
  flap?: (elapsed: number) => void;
}

export interface AmbientAnimation {
  update: (elapsed: number, now: number) => void;
}

export const BLOCKED_ZOOM_DURATION_MS = 180;
export const BLOCKED_ZOOM_SCALE = 1.035;
export const BLOCKED_ZOOM_GESTURE_SETTLE_MS = 140;
export const NAVIGATION_ARROW_Y = 130;
export const NAVIGATION_ARROW_SCALE = 1.65;
export const NAVIGATION_ARROW_SPRING_DURATION_MS = 1120;
export const WASHINGTON_ARROW_POSITION = new THREE.Vector2(420, -175);
export const UNION_ARROW_POSITION = new THREE.Vector2(125, -345);
export const MANHATTAN_CENTER = new THREE.Vector3(220, 28, -400);
export const WASHINGTON_CENTER = new THREE.Vector3(0, 28, 0);
export const UNION_CENTER = new THREE.Vector3(545, 28, -580);
export const WASHINGTON_PARK_VISUAL_CENTER = new THREE.Vector2(-22.2, -7.6);
export const UNION_PARK_VISUAL_CENTER = new THREE.Vector2(579.8, -555.4);
export const MANHATTAN_TILE_RADIUS = 2600;
export const NEIGHBORHOOD_TILE_RADIUS = 900;
export const PARK_ZOOM_HIT_RADIUS = 165;
export const MANHATTAN_CAMERA_HEIGHT = 1500;
// A 50° pitch away from a straight-down (nadir) view.
export const MANHATTAN_CAMERA_RADIUS = (MANHATTAN_CAMERA_HEIGHT - MANHATTAN_CENTER.y) * Math.tan(THREE.MathUtils.degToRad(50));
export const HUDSON_MIN_CITY_TILE_X = -1152;
export const WORLD_UP = new THREE.Vector3(0, 1, 0);

export type MapView = "globe" | "manhattan" | "washington" | "union";

