# Avatar view

This browser-only module renders animated Yuyang avatar models inside the FaceTime-style UI.

## Files

- `avatar-idle-view.tsx` loads and renders the idle GLB, attaches the approved 2D smiling face, and owns the fixed camera, stable full-resolution render buffer, and renderer cleanup. Docking crops and repositions this unchanged canvas instead of rescaling the character.
- `face-canvas.ts` builds the reusable curved 2D face mesh and its atlas-derived neutral smiling texture.
- `fixed-body-animation.ts` applies the shared animation policy that locks the root, torso, hips, and legs while retaining head, arm, hand, and finger motion. Future avatar animations should pass through this helper when the body must remain fixed.
- `index.ts` is the module's public export surface.
- `INFO.md` documents this folder.
