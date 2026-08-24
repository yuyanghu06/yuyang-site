# Startup wave before greeting text

- Wired `wave-hello-review-v2.glb` into the persistent avatar loader as a one-shot first-load animation.
- Added a post-shader-compile animation start hook so the wave begins only after the first visible avatar frame.
- Delayed mounting `AgentChat` until avatar readiness, the experience gate, and wave completion are all true; this makes the initial greeting start only after the wave finishes.
- Removed the chat's former semantic wave command because startup playback is now owned directly by the avatar lifecycle.
- Runtime-normalized the wave to the idle opening pose: every translation/scale and all body, neck, and head rotations remain fixed; only arm/hand rotations move, with exact idle first/last samples. This removes the nod and vertical transition snap.
- Targeted ESLint and full TypeScript checks pass.
