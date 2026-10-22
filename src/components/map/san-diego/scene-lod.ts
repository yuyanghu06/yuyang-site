import * as THREE from "three";
import type { CameraViewId } from "@/agent/context/camera-views";
import { disposeSceneObjects } from "../runtime/dispose-runtime";

export type SanDiegoDetailKind = "original" | "region";
export interface SanDiegoDetailLayer {
  kind: SanDiegoDetailKind;
  group: THREE.Group;
}

export function sanDiegoDetailForView(view: CameraViewId): SanDiegoDetailKind | null {
  if (view === "torrey-highlands" || view === "westview-high-school" || view === "torrey-highlands-plaza"
    || view === "mesa-verde-middle-school" || view === "deer-canyon-elementary-school") return "original";
  return view === "torrey-pines" || view === "park-village" ? "region" : null;
}

/** Own decoded layers independently of navigation; a pending layer never replaces visible scenery. */
export function createSanDiegoLod<T extends SanDiegoDetailLayer>({
  group, overviewOriginal, overviewRegion, load,
}: {
  group: THREE.Group;
  overviewOriginal: THREE.Object3D;
  overviewRegion: THREE.Object3D;
  load: (kind: SanDiegoDetailKind, signal: AbortSignal) => Promise<T>;
}) {
  const layers = new Map<SanDiegoDetailKind, T>();
  const pending = new Map<SanDiegoDetailKind, { controller: AbortController; promise: Promise<void> }>();
  let disposed = false;
  let visibleView: CameraViewId = "san-diego";
  const setView = (view: CameraViewId) => {
    visibleView = view;
    const kind = sanDiegoDetailForView(view);
    const originalVisible = kind === "original" && layers.has("original");
    const regionVisible = kind === "region" && layers.has("region");
    overviewOriginal.visible = !originalVisible;
    overviewRegion.visible = !regionVisible;
    layers.forEach((layer, key) => { layer.group.visible = key === "original" ? originalVisible : regionVisible; });
  };
  const cancelPendingExcept = (view?: CameraViewId) => {
    const keep = view ? sanDiegoDetailForView(view) : null;
    pending.forEach((request, kind) => {
      if (kind === keep) return;
      // Remove before abort so a new request can retry without joining the cancelled promise.
      pending.delete(kind);
      request.controller.abort();
    });
  };
  return {
    isReady(view: CameraViewId) {
      const kind = sanDiegoDetailForView(view);
      return !disposed && (!kind || layers.has(kind));
    },
    ensure(view: CameraViewId, prepare: (layer: T) => void) {
      if (disposed) return Promise.reject(new DOMException("San Diego scene disposed", "AbortError"));
      const kind = sanDiegoDetailForView(view);
      if (!kind || layers.has(kind)) return Promise.resolve();
      const existing = pending.get(kind);
      if (existing) return existing.promise;
      const controller = new AbortController();
      const request = { controller, promise: Promise.resolve() };
      request.promise = load(kind, controller.signal).then((layer) => {
        try {
          controller.signal.throwIfAborted();
          if (disposed) throw new DOMException("San Diego scene disposed", "AbortError");
          // Registration/effects are prepared while detached. On failure the caller rolls back
          // its registries, and this owner releases all partially prepared geometry/materials.
          layer.group.visible = false;
          prepare(layer);
          group.add(layer.group);
          layers.set(kind, layer);
          setView(visibleView);
        } catch (error) {
          layer.group.removeFromParent();
          disposeSceneObjects([layer.group]);
          throw error;
        }
      }).finally(() => {
        if (pending.get(kind) === request) pending.delete(kind);
      });
      pending.set(kind, request);
      return request.promise;
    },
    setView,
    cancelPendingExcept,
    dispose() {
      if (disposed) return;
      disposed = true;
      cancelPendingExcept();
      group.removeFromParent();
      disposeSceneObjects([group]);
      group.clear();
      layers.clear();
    },
  };
}
