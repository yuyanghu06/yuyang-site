import * as THREE from "three";
import type { ClickableLandmark } from "../manhattan/navigation";

export function animateLandmarks(
  landmarks: ClickableLandmark[],
  elapsed: number,
  interactionEase: number,
  renderer: THREE.WebGLRenderer,
) {
  const selected = landmarks.find((landmark) => landmark.selected);
  for (const landmark of landmarks) {
    const lift = !landmark.selected && landmark.hovered ? 4.5 : 0;
    const previousY = landmark.root.position.y;
    landmark.root.position.y = THREE.MathUtils.lerp(
      landmark.root.position.y,
      landmark.baseY + lift,
      interactionEase,
    );
    if (Math.abs(landmark.root.position.y - previousY) > 0.001) {
      renderer.shadowMap.needsUpdate = true;
    }
    const glowMaterial = (landmark.glow.children[0] as THREE.Mesh | undefined)?.material;
    if (!(glowMaterial instanceof THREE.MeshBasicMaterial)) continue;
    const wave = 0.5 + Math.sin(elapsed * 3.4 + landmark.baseY * 0.17) * 0.5;
    const hue = 0.56 + Math.sin(elapsed * 0.85 + landmark.baseY * 0.11) * 0.095;
    glowMaterial.color.setHSL(hue, 0.72, 0.72);
    const suppressed = selected && selected !== landmark;
    glowMaterial.opacity = THREE.MathUtils.lerp(
      glowMaterial.opacity,
      suppressed ? 0 : (landmark.hovered || landmark.selected ? 0.18 : 0.1) + wave * 0.12,
      interactionEase,
    );
  }
}
