# Avatar view

This browser-only module provides one shared full-screen composition for animated Yuyang avatar states inside the FaceTime-style UI.

## Subfolders

- `idle/` owns only the idle GLB and idle animation setup supplied to the shared renderer.
- `vrm-animation/` contains the VRM Game Starter's MIT-licensed world-space humanoid retargeter and its VRM bone contract.

## Files

- `avatar-fullscreen.tsx` owns the reusable right-offset full-screen camera, 225% full-screen avatar scale, revised vertical composition, vertical render overscan, scene-local lighting, material response, 30 FPS visibility-aware render loop, cleanup, and stable canvas. It emits its readiness callback only after the GLB is mounted, shaders compile, and the first frame renders. Its animation source may provide a per-frame facial-state updater and disposer; the renderer forwards current talking state without remounting the Three.js scene or body animation. Its horizontal camera offset compensates for the enlarged scale so the approved left/right placement remains stable between the message stack and right viewport margin.
- `fixed-body-animation.ts` applies the shared animation policy that locks the root, torso, hips, and legs while retaining head, arm, hand, and finger motion. Future avatar animations should pass through this helper when the body must remain fixed.
- `index.ts` is the module's public export surface.
- `INFO.md` documents this folder.
