# Idle avatar view

This folder contains the idle-specific implementation for the shared full-screen avatar renderer.

## Files

- `idle.tsx` imports the shared agent emote-request contract, loads `/animations/idle.glb` as the single persistent avatar scene, and loads the tiny animation-only wave, nod, and head-shake GLBs as disposable clip sources through versioned, immutable-cache URLs. Startup invokes `wave_hello` through the shared emote player; later validated emote requests invoke the same player and resolve only after the one-shot returns to `Idle_Loop`. The existing Head-skinned face canvas supplies blink/talking states plus the nod's open smile and the shake's disappointed face. No renderer remount, duplicate emote mesh, or detached face geometry is used.
- `INFO.md` documents this folder.
