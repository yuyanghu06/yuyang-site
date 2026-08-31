import * as THREE from "three";
import { BLOCKED_ZOOM_GESTURE_SETTLE_MS, type MapView } from "../shared/core";
import type { ClickableLandmark } from "../manhattan/navigation";

interface PointerHitTesting {
  globeManhattanAtPointer: (event: { clientX: number; clientY: number }) => boolean;
  landmarkAtPointer: (event: { clientX: number; clientY: number }) => ClickableLandmark | null;
  navigationAtPointer: (event: { clientX: number; clientY: number }) => boolean;
  manhattanMarkerAtPointer: (event: { clientX: number; clientY: number }) => MapView | null;
  parkDestinationAtPointer: (event: { clientX: number; clientY: number }) => MapView | null;
}

export interface InputControllerOptions extends PointerHitTesting {
  renderer: THREE.WebGLRenderer;
  clickableLandmarks: ClickableLandmark[];
  getActiveView: () => MapView;
  getCameraLocked: () => boolean;
  isGlobeTransitioning: () => boolean;
  getGlobeCameraDistance: () => number;
  getGlobeMarkerFacing: () => number;
  enterManhattanFromGlobe: () => void;
  enterGlobeFromManhattan: () => void;
  blockGlobeZoom: () => void;
  zoomGlobeOut: (distance: number) => void;
  rotateGlobe: (yaw: number, pitch: number) => void;
  rotateNeighborhood: (deltaX: number) => void;
  switchView: (view: MapView) => void;
  selectLandmark: (landmark: ClickableLandmark) => void;
  clearLandmarkSelection: () => void;
  triggerBlockedZoom: (event: WheelEvent) => void;
}

export function createInputController(options: InputControllerOptions) {
  const TOUCH_ZOOM_THRESHOLD = 24;
  let dragging = false;
  let globeDragging = false;
  const touchPointers = new Map<number, { x: number; y: number }>();
  let touchDistance = 0;
  let touchZoomDelta = 0;
  let multiTouchGesture = false;
  let interactionFullRateUntil = 0;
  let pointerX = 0;
  let pointerY = 0;
  let pointerDownX = 0;
  let pointerDownY = 0;
  let pointerMoved = false;
  let lastHitTestAt = Number.NEGATIVE_INFINITY;
  let blockedZoomGestureActive = false;
  let blockedZoomGestureReset = 0;
  let zoomOutGestureActive = false;
  let zoomOutGestureReset = 0;

  const routeZoom = (deltaY: number, event: { clientX: number; clientY: number; preventDefault: () => void }) => {
    const activeView = options.getActiveView();
    if (activeView === "globe") {
      event.preventDefault();
      interactionFullRateUntil = performance.now() + 180;
      if (deltaY < 0) {
        if (options.globeManhattanAtPointer(event)) options.enterManhattanFromGlobe();
        else options.blockGlobeZoom();
      } else options.zoomGlobeOut(options.getGlobeCameraDistance() * Math.exp(deltaY * 0.0025));
      return;
    }
    if (deltaY > 0) {
      event.preventDefault();
      window.clearTimeout(zoomOutGestureReset);
      zoomOutGestureReset = window.setTimeout(() => { zoomOutGestureActive = false; }, BLOCKED_ZOOM_GESTURE_SETTLE_MS);
      if (zoomOutGestureActive) return;
      zoomOutGestureActive = true;
    }
    if (options.getCameraLocked()) {
      if (deltaY > 0) options.clearLandmarkSelection();
      else if (deltaY < 0) {
        event.preventDefault();
        window.clearTimeout(blockedZoomGestureReset);
        blockedZoomGestureReset = window.setTimeout(() => { blockedZoomGestureActive = false; }, BLOCKED_ZOOM_GESTURE_SETTLE_MS);
        if (blockedZoomGestureActive) return;
        blockedZoomGestureActive = true;
        const hovered = options.landmarkAtPointer(event);
        if (hovered && !hovered.selected) options.selectLandmark(hovered);
      }
      return;
    }
    if (deltaY > 0) {
      if (activeView === "manhattan") options.enterGlobeFromManhattan();
      else options.switchView("manhattan");
      return;
    }
    if (deltaY >= 0) return;
    event.preventDefault();
    window.clearTimeout(blockedZoomGestureReset);
    blockedZoomGestureReset = window.setTimeout(() => { blockedZoomGestureActive = false; }, BLOCKED_ZOOM_GESTURE_SETTLE_MS);
    if (blockedZoomGestureActive) return;
    blockedZoomGestureActive = true;
    const parkDestination = options.parkDestinationAtPointer(event);
    if (parkDestination) options.switchView(parkDestination);
    else {
      const hovered = options.landmarkAtPointer(event);
      if (hovered) options.selectLandmark(hovered);
      else options.triggerBlockedZoom(event as WheelEvent);
    }
  };

  const pointerDown = (event: PointerEvent) => {
    const activeView = options.getActiveView();
    dragging = !options.getCameraLocked() && activeView !== "manhattan" && activeView !== "globe";
    if (event.pointerType === "touch" && !options.isGlobeTransitioning()) {
      touchPointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      globeDragging = activeView === "globe";
      touchZoomDelta = 0;
      if (touchPointers.size >= 2) {
        const touches = [...touchPointers.values()];
        touchDistance = Math.hypot(touches[1].x - touches[0].x, touches[1].y - touches[0].y);
        multiTouchGesture = true;
      }
    } else {
      globeDragging = activeView === "globe" && !options.isGlobeTransitioning();
    }
    pointerX = pointerDownX = event.clientX;
    pointerY = pointerDownY = event.clientY;
    pointerMoved = false;
    options.renderer.domElement.setPointerCapture(event.pointerId);
    if (dragging || globeDragging) options.renderer.domElement.classList.add("is-dragging");
  };

  const pointerMove = (event: PointerEvent) => {
    if (options.getActiveView() === "globe") interactionFullRateUntil = performance.now() + 180;
    if (event.pointerType === "touch" && touchPointers.has(event.pointerId)) {
      touchPointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (touchPointers.size >= 2) {
        const touches = [...touchPointers.values()];
        const nextDistance = Math.hypot(touches[1].x - touches[0].x, touches[1].y - touches[0].y);
        if (touchDistance > 0 && nextDistance > 0) {
          const pinchDelta = Math.log(touchDistance / nextDistance) * 500;
          if (options.getActiveView() === "globe") {
            const currentDistance = options.getGlobeCameraDistance();
            const requestedDistance = currentDistance * (touchDistance / nextDistance);
            if (requestedDistance < currentDistance) {
              if (options.getGlobeMarkerFacing() > 0.94) options.enterManhattanFromGlobe();
              else options.blockGlobeZoom();
            } else options.zoomGlobeOut(requestedDistance);
          } else {
            touchZoomDelta += pinchDelta;
            if (Math.abs(touchZoomDelta) >= TOUCH_ZOOM_THRESHOLD) {
              routeZoom(touchZoomDelta, event);
              touchZoomDelta = 0;
            }
          }
        }
        touchDistance = nextDistance;
        pointerMoved = true;
        return;
      }
    }
    pointerMoved ||= Math.hypot(event.clientX - pointerDownX, event.clientY - pointerDownY) > 5;
    if (globeDragging) {
      options.rotateGlobe((event.clientX - pointerX) * 0.0045, (event.clientY - pointerY) * 0.0032);
      pointerX = event.clientX;
      pointerY = event.clientY;
      return;
    }
    if (dragging) {
      options.rotateNeighborhood(event.clientX - pointerX);
      pointerX = event.clientX;
      return;
    }
    if (event.timeStamp - lastHitTestAt < 1000 / 30) return;
    lastHitTestAt = event.timeStamp;
    if (options.getActiveView() === "globe") {
      options.renderer.domElement.style.cursor = options.globeManhattanAtPointer(event) ? "pointer" : "default";
      return;
    }
    const hovered = options.landmarkAtPointer(event);
    options.clickableLandmarks.forEach((landmark) => { landmark.hovered = landmark === hovered; });
    options.renderer.domElement.style.cursor = hovered
      || options.navigationAtPointer(event)
      || options.manhattanMarkerAtPointer(event)
      || options.parkDestinationAtPointer(event)
      ? "pointer" : "default";
  };

  const pointerUp = (event: PointerEvent) => {
    const endedMultiTouchGesture = multiTouchGesture;
    if (event.pointerType === "touch") {
      touchPointers.delete(event.pointerId);
      if (touchPointers.size < 2) globeDragging = false;
      if (touchPointers.size === 0) multiTouchGesture = false;
    }
    if (!pointerMoved && !endedMultiTouchGesture) {
      if (options.globeManhattanAtPointer(event)) options.enterManhattanFromGlobe();
      else {
        const markerDestination = options.manhattanMarkerAtPointer(event);
        const parkDestination = options.parkDestinationAtPointer(event);
        if (markerDestination) options.switchView(markerDestination);
        else if (parkDestination) options.switchView(parkDestination);
        else if (options.navigationAtPointer(event)) {
          options.switchView(options.getActiveView() === "union" ? "washington" : "union");
        } else {
          const landmark = options.landmarkAtPointer(event);
          if (landmark) options.selectLandmark(landmark);
        }
      }
    }
    dragging = false;
    if (event.pointerType !== "touch") globeDragging = false;
    if (options.renderer.domElement.hasPointerCapture(event.pointerId)) {
      options.renderer.domElement.releasePointerCapture(event.pointerId);
    }
    options.renderer.domElement.classList.remove("is-dragging");
  };

  const keyDown = (event: KeyboardEvent) => {
    if (event.key === "Escape" && options.getCameraLocked()) options.clearLandmarkSelection();
  };
  const wheel = (event: WheelEvent) => {
    routeZoom(event.deltaY * (event.ctrlKey ? 1.6 : 1), event);
  };

  const element = options.renderer.domElement;
  element.addEventListener("pointerdown", pointerDown);
  element.addEventListener("pointermove", pointerMove);
  element.addEventListener("pointerup", pointerUp);
  element.addEventListener("pointercancel", pointerUp);
  element.addEventListener("wheel", wheel, { passive: false });
  window.addEventListener("keydown", keyDown);
  return {
    isDragging: () => dragging,
    isGlobeDragging: () => globeDragging,
    getInteractionFullRateUntil: () => interactionFullRateUntil,
    keepFullFrameRateUntil: (until: number) => { interactionFullRateUntil = until; },
    dispose: () => {
      element.removeEventListener("pointerdown", pointerDown);
      element.removeEventListener("pointermove", pointerMove);
      element.removeEventListener("pointerup", pointerUp);
      element.removeEventListener("pointercancel", pointerUp);
      element.removeEventListener("wheel", wheel);
      window.removeEventListener("keydown", keyDown);
      window.clearTimeout(blockedZoomGestureReset);
      window.clearTimeout(zoomOutGestureReset);
    },
  };
}
