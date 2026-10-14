# Map interaction

Pointer hit-testing and input controllers live here. There are no direct subfolders. Keep raycasting against merged interaction roots and preserve the shared renderer/camera state owned by the runtime. Neighborhood dragging rechecks the active view and camera lock on every move, so navigation during a held gesture cannot rotate a fixed destination camera.

## Files

- `hit-testing.ts` resolves both globe destinations, selected-city landmarks, New York neighborhood markers, and the square navigation arrow. It rejects invisible ancestors, wrong-city/parent landmarks, globe-transition picks, and New York-only arrows outside their two neighborhoods.
- `input-controller.ts` owns pointer capture, mouse/touch dragging, pinch and wheel routing, Escape, hover throttling, view clicks, and gesture timers. San Diego's authoring flag is disabled: mouse or one-finger dragging rotates the unlocked overview horizontally through the shared azimuth-only callback; vertical motion cannot change pitch, and both locked landmark cameras remain fixed. Wheel and two-finger pinch use guided landmark/overview/globe navigation; landmark clicks and Escape retain the same guided flow. Normal globe/New York routing remains: single-finger dragging rotates the globe or unlocked Washington/Union neighborhoods, while locked landmarks use authored navigation. Pointer cancellation cannot select a landmark. The retained free-camera branch is inactive unless explicitly re-enabled; it supports orbit/tilt, pan, continuous zoom, and San Diego-only context-menu suppression.
- `info.md` is this folder guide.
