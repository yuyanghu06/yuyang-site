# Avatar production-angle head-up correction

- User review rejected the interim face-canvas translation, UV shift, and localized chin lift because they moved the artwork rather than turning the chin and left the face off-center.
- Restored the embedded face's original fitted geometry, UV placement, object transform, and close skin clearance.
- Retained complete location, rotation, and scale locks and verified all 442 vertices remain weighted exactly and exclusively to `Head`.
- Baked a 15° upward local `Head` offset across the complete idle so the skull and chin turn together from the website's production viewing angle.
- Preserved the full five-second `Idle_Loop` at 30 fps and exact `0.0` pose-matrix loop closure.
- Saved `assets/blender/yuyang-avatar-talking-loop-face-v2.blend`, exported the corrected `public/animations/idle.glb`, and advanced the runtime cache key.
- A clean GLB round trip retained 52 bones, the 442-vertex embedded face, one `Idle_Loop` over frames 0–150, and exact loop closure.
