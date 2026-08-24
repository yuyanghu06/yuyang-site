# Avatar view

This browser-only module provides one shared full-screen composition for animated Yuyang avatar states inside the FaceTime-style UI.

## Subfolders

- `idle/` owns only the idle GLB and idle animation setup supplied to the shared renderer.
- `vrm-animation/` contains the VRM Game Starter's MIT-licensed world-space humanoid retargeter and its VRM bone contract.

## Files

- `avatar-fullscreen.tsx` owns the reusable right-offset full-screen camera, 225% full-screen avatar scale, revised vertical composition, vertical render overscan, texture-preserving four-step toon materials for the body/hair/clothing, the untouched animated illustrated-face material path, 30 FPS visibility-aware render loop, cleanup, and stable canvas. It does not add a post-process outline or runtime chin artwork. It emits its readiness callback only after the GLB is mounted, shaders compile, and the first frame renders. An animation source may provide a `start` hook that runs immediately after that first compiled render, preventing a one-shot introduction from advancing invisibly during shader compilation; it may also provide a per-frame facial-state updater and disposer. The renderer forwards current talking state without remounting the Three.js scene or body animation. Its horizontal camera offset compensates for the enlarged scale so the approved left/right placement remains stable between the message stack and right viewport margin.
- `fixed-body-animation.ts` applies the shared animation policy that locks the root, torso, hips, and legs while retaining head, arm, hand, and finger motion. Future avatar animations should pass through this helper when the body must remain fixed.
- `index.ts` is the module's public export surface.
- `INFO.md` documents this folder.
