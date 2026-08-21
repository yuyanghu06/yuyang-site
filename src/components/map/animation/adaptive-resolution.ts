import * as THREE from "three";

interface AdaptiveResolutionOptions {
  renderer: THREE.WebGLRenderer;
  minimumPixelRatio: number;
  maximumPixelRatio: number;
  initialPixelRatio: number;
  resize: () => void;
  report: (pixelRatio: number, averageRenderMs: number) => void;
}

export function createAdaptiveResolution(options: AdaptiveResolutionOptions) {
  let activePixelRatio = options.initialPixelRatio;
  let samples = 0;
  let totalCost = 0;
  return (renderCost: number) => {
    totalCost += renderCost;
    samples += 1;
    if (samples !== 120) return;
    const average = totalCost / samples;
    const target = average > 18
      ? Math.max(options.minimumPixelRatio, activePixelRatio - 0.25)
      : average < 8
        ? Math.min(options.maximumPixelRatio, activePixelRatio + 0.25)
        : activePixelRatio;
    if (target !== activePixelRatio) {
      activePixelRatio = target;
      options.renderer.setPixelRatio(activePixelRatio);
      options.resize();
      options.report(activePixelRatio, Math.round(average * 10) / 10);
    }
    samples = 0;
    totalCost = 0;
  };
}
