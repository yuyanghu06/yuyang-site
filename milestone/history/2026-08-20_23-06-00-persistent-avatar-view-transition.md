# Persistent avatar view transition

- Moved the live idle renderer from `src/components/avatar-idle-view.tsx` into the documented `src/components/avatar-view/` module.
- Extracted `createFixedBodyAnimationClip` as the shared policy for keeping the root, torso, hips, and legs static while allowing head, arms, hands, and fingers to animate.
- Kept a single GLB, Three.js scene, renderer, mixer, and face canvas mounted across expanded and docked FaceTime states.
- Replaced the end-of-transition camera snap with a synchronized 460 ms full-body-to-bust camera interpolation.
- Decoupled GLB and face-atlas loading so a face texture failure cannot hide the avatar body.
- Retained untransformed layout sizing to prevent low-resolution rendering after reopening.
- Verified the changed React/Three.js files with targeted ESLint and TypeScript checks; both pass. The local page, GLB, and face atlas each return HTTP 200. Browser automation was unavailable, so final transition appearance still requires user visual confirmation.
