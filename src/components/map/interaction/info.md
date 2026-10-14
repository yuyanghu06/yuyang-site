# Map interaction

All four Torrey Highlands landmarks use that district as their parent. District click/pinch and Escape/back traversal coexist with yaw rotation in all San Diego district and selected landmark views. The base San Diego overview has fixed rotation; New York interactions retain their prior policy.

Pointer hit-testing and input controllers live here. There are no direct subfolders. Keep building raycasts against merged interaction roots and preserve the shared renderer/camera state owned by the runtime. Geographic district coverage is never a lifted or outlined landmark. Neighborhood dragging rechecks the active view and camera lock on every move, so navigation during a held gesture cannot rotate a fixed destination camera.

## Direct files

- `hit-testing.ts` resolves both globe destinations, selected-city landmarks, New York neighborhood markers, and the square navigation arrow. It rejects invisible ancestors, wrong-city/parent landmarks, globe-transition picks, and New York-only arrows outside their two neighborhoods.
- `input-controller.ts` owns pointer, touch/pinch, wheel and Escape routing, hover/click selection and drag state. The San Diego regional overview cannot rotate; districts and selected San Diego landmarks allow horizontal yaw. New York and globe controls retain their existing policies. Two-finger production gestures route geographic zoom without panning.
- `info.md` is this folder guide.
