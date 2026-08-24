# Idle avatar view

This folder contains the idle-specific implementation for the shared full-screen avatar renderer.

## Files

- `idle.tsx` loads both the approved `/animations/idle.glb` and `/animations/wave-hello-review-v2.glb` animation source onto one persistent idle avatar scene. After the first compiled render it plays `wave_hello` once, then switches to `Idle_Loop` and reports wave completion to the call shell. The runtime wave builder holds every translation and scale plus all hips, torso, neck, head, and non-arm rotations at the exact idle opening values; only arm/hand rotations move, and their first/last samples are replaced with the idle opening values. This removes the wave nod and height snap. A single runtime face canvas independently composites the approved open/closed eye artwork and transparent talking-mouth overlays on the existing Head-skinned mesh. It retains its normal depth behavior and contains no added chin or outline artwork. Idle retains two brief natural blinks per loop; streamed speech opens immediately, advances its mouth every 80 ms, and does not interrupt the separate blink clock. No renderer remount or detached face geometry is used.
- `INFO.md` documents this folder.
