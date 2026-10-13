# Map interaction

Pointer hit-testing and input controllers live here. There are no direct subfolders. Keep building raycasts against merged interaction roots and preserve the shared renderer/camera state owned by the runtime. Geographic district coverage is never a lifted or outlined landmark. Neighborhood dragging rechecks the active view and camera lock on every move, so navigation during a held gesture cannot rotate a fixed destination camera.

## Direct files

- `hit-testing.ts` resolves both globe destinations, selected-city landmarks, New York neighborhood markers, the square navigation arrow, and San Diego's three district markers/ground bounds. It rejects invisible ancestors, wrong-city/parent landmarks, globe-transition picks, and New York-only arrows outside their two neighborhoods. District coverage picks only operate in the broad San Diego overview; the waterfall label has no destination or picking behavior.
- `input-controller.ts` owns pointer capture, mouse/touch dragging, pinch and wheel routing, Escape, hover throttling, view clicks, and gesture timers. San Diego's authoring flag is disabled: all geographic and landmark views retain fixed authored camera angles. Wheel/pinch and clicks enter district coverage or landmarks; zooming out uses the registry's parent hierarchy. Escape exits landmarks, then San Diego districts, then the region to the globe. Pinch picking uses the two-finger center. Existing globe/New York rotation and guided navigation remain; pointer cancellation cannot select a landmark. The retained free-camera branch supports orbit/tilt, pan, continuous zoom, and San Diego-only context-menu suppression if explicitly re-enabled.
- `info.md` is this folder guide.
