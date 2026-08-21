import * as THREE from "three";
import {
  NAVIGATION_ARROW_SCALE,
  NAVIGATION_ARROW_SPRING_DURATION_MS,
  NAVIGATION_ARROW_Y,
  type MapView,
} from "../shared/core";

export function animateNavigationArrow(
  arrow: THREE.Group | null,
  activeView: MapView,
  now: number,
  elapsed: number,
  springStartedAt: number,
  springComplete: boolean,
) {
  if (!arrow || activeView === "manhattan" || now < springStartedAt) return springComplete;
  arrow.visible = true;
  if (springComplete) {
    arrow.position.y = NAVIGATION_ARROW_Y + Math.sin(elapsed * 1.8) * 3;
    return true;
  }
  const progress = THREE.MathUtils.clamp(
    (now - springStartedAt) / NAVIGATION_ARROW_SPRING_DURATION_MS,
    0,
    1,
  );
  const spring = 1 - Math.exp(-4.8 * progress) * Math.cos(12.5 * progress);
  arrow.scale.setScalar(NAVIGATION_ARROW_SCALE * Math.max(0.001, spring));
  arrow.position.y = NAVIGATION_ARROW_Y - 34 * (1 - spring);
  if (progress < 1) return false;
  arrow.scale.setScalar(NAVIGATION_ARROW_SCALE);
  return true;
}

export function animateDestinationMarkers(
  markers: THREE.Group | null,
  now: number,
  elapsed: number,
  exitStartedAt: number,
  enterStartedAt: number,
) {
  if (!markers?.visible) return { exitStartedAt, enterStartedAt };
  const exitProgress = exitStartedAt
    ? THREE.MathUtils.clamp((now - exitStartedAt) / 240, 0, 1)
    : 0;
  const enterProgress = enterStartedAt
    ? THREE.MathUtils.clamp((now - enterStartedAt) / 240, 0, 1)
    : 1;
  const opacity = exitStartedAt
    ? 1 - THREE.MathUtils.smoothstep(exitProgress, 0, 1)
    : THREE.MathUtils.smoothstep(enterProgress, 0, 1);
  markers.children.forEach((marker, index) => {
    marker.position.y = marker.userData.baseY + Math.sin(elapsed * 1.55 + index * 1.8) * (4 / 0.3);
    marker.traverse((object) => {
      if (object instanceof THREE.Sprite) object.material.opacity = opacity;
    });
  });
  if (enterStartedAt && enterProgress >= 1) enterStartedAt = 0;
  if (exitProgress >= 1) {
    markers.visible = false;
    exitStartedAt = 0;
  }
  return { exitStartedAt, enterStartedAt };
}

export function animateNeighborhoodMarkers(
  markersByView: Map<"washington" | "union", THREE.Group[]>,
  activeView: MapView,
  elapsed: number,
  cameraLocked: boolean,
  interactionEase: number,
) {
  markersByView.forEach((markers, view) => {
    markers.forEach((marker, index) => {
      if (activeView !== view) {
        marker.visible = false;
        return;
      }
      marker.position.y = marker.userData.baseY
        + Math.sin(elapsed * 1.55 + index * 0.72 + (view === "union" ? 1.8 : 0)) * 4;
      let opacity = 1;
      marker.traverse((object) => {
        if (!(object instanceof THREE.Sprite)) return;
        object.material.opacity = THREE.MathUtils.lerp(
          object.material.opacity,
          cameraLocked ? 0 : 1,
          interactionEase,
        );
        opacity = object.material.opacity;
      });
      marker.visible = !cameraLocked || opacity > 0.01;
    });
  });
}
