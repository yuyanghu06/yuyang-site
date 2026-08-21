import * as THREE from "three";

interface ViewportLifecycleOptions {
  mount: HTMLElement;
  timer: THREE.Timer;
  isDisposed: () => boolean;
  visibilityWaiters: Set<() => void>;
  requestFrame: () => number;
  cancelFrame: (frame: number) => void;
}

export function createViewportLifecycle(options: ViewportLifecycleOptions) {
  let isIntersecting = true;
  let animationRunning = false;
  let frame = 0;
  const shouldAnimate = () => (
    isIntersecting
    && document.visibilityState === "visible"
    && !options.isDisposed()
  );
  const startAnimation = () => {
    if (animationRunning || !shouldAnimate()) return;
    animationRunning = true;
    options.timer.reset();
    frame = options.requestFrame();
  };
  const stopAnimation = () => {
    options.cancelFrame(frame);
    animationRunning = false;
  };
  const observer = new IntersectionObserver(([entry]) => {
    isIntersecting = entry.isIntersecting;
    if (shouldAnimate()) startAnimation();
    else stopAnimation();
  }, { threshold: 0.01 });
  observer.observe(options.mount);
  const handleVisibility = () => {
    if (shouldAnimate()) {
      for (const resolve of options.visibilityWaiters) resolve();
      options.visibilityWaiters.clear();
      startAnimation();
    } else {
      stopAnimation();
    }
  };
  document.addEventListener("visibilitychange", handleVisibility);
  return {
    shouldAnimate,
    startAnimation,
    markAnimationStopped: () => { animationRunning = false; },
    setFrame: (nextFrame: number) => { frame = nextFrame; },
    dispose: () => {
      stopAnimation();
      observer.disconnect();
      document.removeEventListener("visibilitychange", handleVisibility);
    },
  };
}
