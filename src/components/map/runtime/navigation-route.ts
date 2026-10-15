import {
  getCameraView,
  getCityOverview,
  getParentMapView,
  isSanDiegoView,
  type CameraViewId,
} from "@/agent/context/camera-views";

/** One authored stop at a time; city changes always pass through the globe. */
export function getNextNavigationView(current: CameraViewId, destination: CameraViewId): CameraViewId | null {
  if (current === destination) return null;
  const target = getCameraView(destination);
  const source = getCameraView(current);
  if (!target || !source) return null;
  if (current === "globe") return getCityOverview(destination);
  const sourceCity = getCityOverview(current);
  const targetCity = getCityOverview(destination);
  if (destination === "globe" || sourceCity !== targetCity) return getParentMapView(current);
  if (source.kind === "landmark") {
    if (target.kind === "landmark" && target.neighborhood === source.neighborhood) return destination;
    return source.neighborhood;
  }
  const targetGeography = target.kind === "landmark" ? target.neighborhood : destination;
  if (current === targetGeography) return destination;
  // Preserve New York's direct neighborhood-to-neighborhood traversal.
  if (!isSanDiegoView(current)) return targetGeography;
  let next: CameraViewId = targetGeography;
  for (let parent = getParentMapView(next); parent; parent = getParentMapView(parent)) {
    if (parent === current) return next;
    next = parent;
  }
  return getParentMapView(current);
}
