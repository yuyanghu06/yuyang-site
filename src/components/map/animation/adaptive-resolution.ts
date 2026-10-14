import * as THREE from "three";

export interface AdaptiveResolutionLimits {
  minimumPixelRatio: number;
  maximumPixelRatio: number;
}

interface AdaptiveResolutionOptions extends AdaptiveResolutionLimits {
  renderer: THREE.WebGLRenderer;
  initialPixelRatio: number;
  resize: () => void;
  report: (pixelRatio: number, averageRenderMs: number) => void;
}

export function createAdaptiveResolution(options: AdaptiveResolutionOptions) {
  let minimumPixelRatio = options.minimumPixelRatio;
  let maximumPixelRatio = options.maximumPixelRatio;
  let activePixelRatio = THREE.MathUtils.clamp(
    options.initialPixelRatio, minimumPixelRatio, maximumPixelRatio,
  );
  let samples = 0;
  let totalCost = 0;
  const resetSamples = () => {
    samples = 0;
    totalCost = 0;
  };
  const applyPixelRatio = (target: number, averageRenderMs: number) => {
    if (target === activePixelRatio) return;
    activePixelRatio = target;
    options.renderer.setPixelRatio(activePixelRatio);
    options.resize();
    options.report(activePixelRatio, averageRenderMs);
  };
  const recordRenderCost = (renderCost: number) => {
    if (!Number.isFinite(renderCost) || renderCost < 0) return;
    totalCost += renderCost;
    samples += 1;
    if (samples !== 120) return;
    const average = totalCost / samples;
    const target = average > 18
      ? Math.max(minimumPixelRatio, activePixelRatio - 0.25)
      : average < 8
        ? Math.min(maximumPixelRatio, activePixelRatio + 0.25)
        : activePixelRatio;
    applyPixelRatio(target, Math.round(average * 10) / 10);
    resetSamples();
  };
  recordRenderCost.setLimits = (
    limits: AdaptiveResolutionLimits & { initialPixelRatio?: number },
  ) => {
    minimumPixelRatio = limits.minimumPixelRatio;
    maximumPixelRatio = limits.maximumPixelRatio;
    resetSamples();
    applyPixelRatio(THREE.MathUtils.clamp(
      limits.initialPixelRatio ?? activePixelRatio, minimumPixelRatio, maximumPixelRatio,
    ), 0);
  };
  recordRenderCost.resetSamples = resetSamples;
  return recordRenderCost;
}
