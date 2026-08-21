# Map interaction

Pointer hit-testing and input controllers live here. `input-controller.ts` owns pointer capture, mouse/touch dragging, pinch and wheel routing, keyboard Escape, hover throttling, view clicks, and gesture timers. Keep raycasting against merged interaction roots and preserve the shared renderer/camera state owned by the runtime.
