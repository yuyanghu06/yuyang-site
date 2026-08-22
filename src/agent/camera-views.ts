export type GeographicMapView = "globe" | "manhattan" | "washington" | "union";

interface GeographicCameraView {
  id: GeographicMapView;
  label: string;
  kind: "geographic";
}

export interface LandmarkCameraView {
  id: string;
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

export const CAMERA_VIEWS = [
  { id: "globe", label: "Globe", kind: "geographic" },
  { id: "manhattan", label: "Manhattan", kind: "geographic" },
  { id: "washington", label: "Washington Square", kind: "geographic" },
  { id: "union", label: "Union Square", kind: "geographic" },
  {
    id: "bobst-library",
    label: "Bobst Library",
    kind: "landmark",
    neighborhood: "washington",
    rootNameIncludes: "Bobst",
    azimuth: Math.PI - 0.42,
    height: 210,
    radius: 365,
    zoom: 2.41,
  },
  {
    id: "lipton-hall",
    label: "Lipton Hall",
    kind: "landmark",
    neighborhood: "washington",
    rootNameIncludes: "Lipton",
    azimuth: 0,
    height: 273,
    radius: 285,
    zoom: 2.41,
  },
  {
    id: "courant-institute",
    label: "Courant Institute",
    kind: "landmark",
    neighborhood: "washington",
    rootNameIncludes: "Courant",
    targetOffset: [-10, 0, -24],
    azimuth: 0,
    height: 210,
    radius: 365,
    zoom: 2.41,
  },
  {
    id: "stern-school-of-business",
    label: "Stern School of Business",
    kind: "landmark",
    neighborhood: "washington",
    rootNameIncludes: "Stern",
    azimuth: Math.PI / 2 + 0.42,
    height: 252,
    radius: 365,
    zoom: 2.41,
  },
  {
    id: "25-union-square-west",
    label: "25 Union Square West",
    kind: "landmark",
    neighborhood: "union",
    rootNameIncludes: "25 Union Square West",
    azimuth: Math.PI / 2 + 0.34,
    height: 160,
    radius: 270,
    zoom: 2.41,
    elevationAngleOffset: Math.PI / 12,
  },
  {
    id: "235-park-avenue-south",
    label: "235 Park Avenue South",
    kind: "landmark",
    neighborhood: "union",
    rootNameIncludes: "235 Park Avenue South",
    azimuth: -Math.PI * 5 / 12,
    height: 235,
    radius: 330,
    zoom: 2.41,
  },
] as const satisfies readonly (GeographicCameraView | LandmarkCameraView)[];

export type CameraView = (typeof CAMERA_VIEWS)[number];
export type CameraViewId = CameraView["id"];
export type LandmarkCameraViewId = Extract<CameraView, { kind: "landmark" }>["id"];

export const CAMERA_VIEW_IDS = CAMERA_VIEWS.map((view) => view.id) as CameraViewId[];

type RegisteredLandmarkCameraView = LandmarkCameraView & { id: LandmarkCameraViewId };

export function getCameraView(id: CameraViewId): GeographicCameraView | RegisteredLandmarkCameraView | undefined {
  return CAMERA_VIEWS.find((view) => view.id === id) as GeographicCameraView | RegisteredLandmarkCameraView | undefined;
}

export function getLandmarkCameraViewForRoot(rootName: string): RegisteredLandmarkCameraView | undefined {
  return CAMERA_VIEWS.find((view) =>
    view.kind === "landmark" && rootName.includes(view.rootNameIncludes),
  ) as RegisteredLandmarkCameraView | undefined;
}
