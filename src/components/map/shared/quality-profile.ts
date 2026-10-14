import type { MapView } from "./core";

export interface MapDeviceCapabilities {
  devicePixelRatio: number;
  hardwareConcurrency: number;
  maxTouchPoints: number;
  coarsePointer: boolean;
  viewportWidth: number;
  viewportHeight: number;
}

export interface MapQualityProfile {
  minimumPixelRatio: number;
  maximumPixelRatio: number;
  initialPixelRatio: number;
  maximumFrameRate: number | null;
  sanDiegoShadowMapSize: number;
}

/** Touch capability and the short viewport edge include phones in landscape,
 * while a small desktop browser window alone does not reduce city quality. */
export function getMapQualityProfile(
  activeView: MapView,
  device: MapDeviceCapabilities,
): MapQualityProfile {
  const devicePixelRatio = Number.isFinite(device.devicePixelRatio) && device.devicePixelRatio > 0
    ? device.devicePixelRatio
    : 1;
  const shortEdge = Math.min(device.viewportWidth, device.viewportHeight);
  const mobileCity = activeView !== "globe"
    && (device.coarsePointer || device.maxTouchPoints > 0)
    && shortEdge > 0
    && shortEdge <= 1024;
  const lowCoreDevice = device.hardwareConcurrency > 0
    && device.hardwareConcurrency <= 4;
  const maximumPixelRatio = Math.min(
    devicePixelRatio,
    mobileCity || lowCoreDevice ? 1.5 : 2,
  );
  return {
    minimumPixelRatio: Math.min(maximumPixelRatio, mobileCity ? 1 : 1.5),
    maximumPixelRatio,
    initialPixelRatio: maximumPixelRatio,
    maximumFrameRate: mobileCity ? 60 : null,
    sanDiegoShadowMapSize: mobileCity ? 1024 : 2048,
  };
}
