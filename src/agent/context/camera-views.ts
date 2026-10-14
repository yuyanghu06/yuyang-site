import cameraViews from "./camera-views.json";

export type SanDiegoDistrictView = "torrey-highlands" | "torrey-pines" | "park-village";
export type GeographicMapView = "globe" | "manhattan" | "washington" | "union" | "san-diego" | SanDiegoDistrictView;
export type LandmarkCameraViewId =
  | "bobst-library"
  | "lipton-hall"
  | "courant-institute"
  | "stern-school-of-business"
  | "25-union-square-west"
  | "235-park-avenue-south"
  | "westview-high-school"
  | "torrey-highlands-plaza"
  | "mesa-verde-middle-school"
  | "deer-canyon-elementary-school";
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
  neighborhood: "washington" | "union" | "torrey-highlands";
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

export function isSanDiegoView(view: CameraViewId): boolean {
  return view === "san-diego" || view === "torrey-highlands" || view === "torrey-pines"
    || view === "park-village" || view === "westview-high-school" || view === "torrey-highlands-plaza"
    || view === "mesa-verde-middle-school" || view === "deer-canyon-elementary-school";
}

export function getCityOverview(view: CameraViewId): "manhattan" | "san-diego" {
  return isSanDiegoView(view) ? "san-diego" : "manhattan";
}

/** Geographic zoom-out destination; tour order is defined separately. */
export function getParentMapView(view: CameraViewId): GeographicMapView | null {
  if (view === "globe") return null;
  if (view === "san-diego" || view === "manhattan") return "globe";
  if (view === "torrey-highlands" || view === "torrey-pines" || view === "park-village") return "san-diego";
  const camera = getCameraView(view);
  return camera?.kind === "landmark" ? camera.neighborhood : "manhattan";
}
