# Map interaction

Pointer hit-testing and input controllers live here. `input-controller.ts` owns pointer capture, mouse/touch dragging, pinch and wheel routing, keyboard Escape, hover throttling, view clicks, and gesture timers. While a landmark camera is locked, inward scrolling over a different interactive landmark transfers selection directly to that landmark's authored camera preset; outward scrolling still returns to the neighborhood overview. Keep raycasting against merged interaction roots and preserve the shared renderer/camera state owned by the runtime.
