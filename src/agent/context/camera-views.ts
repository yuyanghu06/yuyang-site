import cameraViews from "./camera-views.json";

export type GeographicMapView = "globe" | "manhattan" | "washington" | "union";
export type LandmarkCameraViewId =
  | "bobst-library"
  | "lipton-hall"
  | "courant-institute"
  | "stern-school-of-business"
  | "25-union-square-west"
  | "235-park-avenue-south";
export type CameraViewId = GeographicMapView | LandmarkCameraViewId;

interface GeographicCameraView {
  id: GeographicMapView;
  label: string;
  kind: "geographic";
}

export interface LandmarkCameraView {
  id: LandmarkCameraViewId;
  label: string;
  kind: "landmark";
  neighborhood: "washington" | "union";
  rootNameIncludes: string;
  targetOffset?: readonly [number, number, number];
  azimuth: number;
  height: number;
  radius: number;
  zoom: number;
  elevationAngleOffset?: number;
}

export type CameraView = GeographicCameraView | LandmarkCameraView;

export const CAMERA_VIEWS = cameraViews as unknown as readonly CameraView[];

export const CAMERA_VIEW_IDS = CAMERA_VIEWS.map((view) => view.id) as CameraViewId[];

export function getCameraView(id: CameraViewId): CameraView | undefined {
  return CAMERA_VIEWS.find((view) => view.id === id);
}

export function getLandmarkCameraViewForRoot(rootName: string): LandmarkCameraView | undefined {
  return CAMERA_VIEWS.find((view) =>
    view.kind === "landmark" && rootName.includes(view.rootNameIncludes),
  ) as LandmarkCameraView | undefined;
}
