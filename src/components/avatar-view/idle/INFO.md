# Idle avatar view

This folder contains the idle-specific implementation for the shared full-screen avatar renderer.

## Files

- `idle.tsx` loads the cache-busted `/animations/idle.glb`, including the user's approved manual face placement and fully locked Head attachment, and plays its exact five-second embedded `Idle_Loop` with `AnimationMixer`. A single runtime face canvas independently composites the approved open/closed eye artwork and transparent talking-mouth overlays on the existing Head-skinned mesh. Idle retains two brief natural blinks per loop; streamed speech opens immediately, advances its mouth every 80 ms, and does not interrupt the separate blink clock. No renderer remount or detached face geometry is used.
- `INFO.md` documents this folder.
