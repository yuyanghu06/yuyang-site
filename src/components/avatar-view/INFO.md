# Avatar view

This browser-only module provides one shared full-screen composition for animated Yuyang avatar states inside the FaceTime-style UI.

## Subfolders

- `idle/` owns only the idle GLB and idle animation setup supplied to the shared renderer.

## Files

- `avatar-fullscreen.tsx` owns the reusable right-offset full-screen camera, including vertical render overscan that prevents the lower torso from being clipped, lighting, face attachment, WebGL render loop, resource cleanup, and the stable canvas used by every current and future avatar state. The minimized shell linearly translates and scales this unchanged canvas instead of switching cameras.
- `face-canvas.ts` builds the reusable curved 2D face mesh and its atlas-derived neutral smiling texture.
- `fixed-body-animation.ts` applies the shared animation policy that locks the root, torso, hips, and legs while retaining head, arm, hand, and finger motion. Future avatar animations should pass through this helper when the body must remain fixed.
- `index.ts` is the module's public export surface.
- `INFO.md` documents this folder.
