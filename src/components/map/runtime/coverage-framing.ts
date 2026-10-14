import * as THREE from "three";

export interface CoverageCameraPose {
  target: THREE.Vector3;
  azimuth: number;
  height: number;
  radius: number;
  zoom: number;
}
export interface OrthographicViewport {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

function cameraBasis(pose: CoverageCameraPose) {
  const rise = pose.height - pose.target.y;
  if (!(rise > 0) || !(pose.zoom > 0)) throw new Error("Ground coverage requires a downward-looking positive-zoom camera");
  return { sine: Math.sin(pose.azimuth), cosine: Math.cos(pose.azimuth), slope: pose.radius / rise, stretch: Math.hypot(rise, pose.radius) / rise };
}

/** Ray/height-plane intersections for all four viewport corners, without a renderer. */
export function getViewportGroundFootprint(pose: CoverageCameraPose, viewport: OrthographicViewport, elevation: number) {
  const { sine, cosine, slope, stretch } = cameraBasis(pose);
  const heightOffset = (elevation - pose.target.y) * slope;
  return [viewport.left, viewport.right].flatMap((x) => [viewport.bottom, viewport.top].map((y) => new THREE.Vector3(
    pose.target.x + (cosine * x - sine * stretch * y) / pose.zoom + sine * heightOffset,
    elevation,
    pose.target.z + (-sine * x - cosine * stretch * y) / pose.zoom + cosine * heightOffset,
  )));
}

/** Both limiting height planes conservatively contain every intervening terrain ray. */
export function getViewportGroundEnvelope(pose: CoverageCameraPose, viewport: OrthographicViewport, coverage: THREE.Box3) {
  return new THREE.Box3().setFromPoints([
    ...getViewportGroundFootprint(pose, viewport, coverage.min.y),
    ...getViewportGroundFootprint(pose, viewport, coverage.max.y),
  ]);
}

/** Cover the detailed rectangle, minimally adjusting zoom and ground target. */
export function constrainCameraToCoverage(
  pose: CoverageCameraPose,
  viewport: OrthographicViewport,
  coverage: THREE.Box3,
  focus?: THREE.Vector3,
  margin = 12,
): CoverageCameraPose {
  const { sine, cosine, slope, stretch } = cameraBasis(pose);
  const spanX = Math.abs(cosine) * (viewport.right - viewport.left) + Math.abs(sine) * stretch * (viewport.top - viewport.bottom);
  const spanZ = Math.abs(sine) * (viewport.right - viewport.left) + Math.abs(cosine) * stretch * (viewport.top - viewport.bottom);
  const heightSpan = (coverage.max.y - coverage.min.y) * slope;
  const availableX = coverage.max.x - coverage.min.x - Math.abs(sine) * heightSpan - margin * 2;
  const availableZ = coverage.max.z - coverage.min.z - Math.abs(cosine) * heightSpan - margin * 2;
  if (!(availableX > 0 && availableZ > 0)) throw new Error("Detailed map coverage is too small for the camera elevation range");
  const result = { ...pose, target: pose.target.clone(), zoom: Math.max(pose.zoom, spanX / availableX, spanZ / availableZ) };
  const envelope = getViewportGroundEnvelope(result, viewport, coverage);
  const minX = coverage.min.x + margin - (envelope.min.x - result.target.x);
  const maxX = coverage.max.x - margin - (envelope.max.x - result.target.x);
  const minZ = coverage.min.z + margin - (envelope.min.z - result.target.z);
  const maxZ = coverage.max.z - margin - (envelope.max.z - result.target.z);
  if (focus) {
    // Keep the waterfall inside the central 70% of the Park Village camera.
    const x = cosine * (focus.x - result.target.x) - sine * (focus.z - result.target.z);
    const y = (-sine * (focus.x - result.target.x) - cosine * (focus.z - result.target.z)) / stretch
      + slope / stretch * (focus.y - result.target.y);
    const insetX = (viewport.right - viewport.left) * 0.15;
    const insetY = (viewport.top - viewport.bottom) * 0.15;
    const shiftX = x - THREE.MathUtils.clamp(x, (viewport.left + insetX) / result.zoom, (viewport.right - insetX) / result.zoom);
    const shiftY = y - THREE.MathUtils.clamp(y, (viewport.bottom + insetY) / result.zoom, (viewport.top - insetY) / result.zoom);
    result.target.x += cosine * shiftX - sine * stretch * shiftY;
    result.target.z += -sine * shiftX - cosine * stretch * shiftY;
  }
  result.target.x = THREE.MathUtils.clamp(result.target.x, minX, maxX);
  result.target.z = THREE.MathUtils.clamp(result.target.z, minZ, maxZ);
  return result;
}

/** Tight depth planes retain terrain and raised geometry in the visible footprint. */
export function getCoverageDepthRange(pose: CoverageCameraPose, viewport: OrthographicViewport, coverage: THREE.Box3) {
  const { slope, stretch } = cameraBasis(pose);
  const padding = 160;
  const near = Math.max(0.1, (pose.height - coverage.max.y) * stretch + slope * viewport.bottom / pose.zoom - padding);
  const far = Math.max(near + 1, (pose.height - coverage.min.y) * stretch + slope * viewport.top / pose.zoom + padding);
  return { near, far };
}
