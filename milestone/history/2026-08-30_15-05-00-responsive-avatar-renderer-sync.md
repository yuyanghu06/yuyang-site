# Responsive avatar renderer synchronization

- Added guarded expanded-window resize and modal-transition completion handlers to the persistent Three.js avatar renderer.
- Responsive synchronization temporarily releases cached CSS dimensions, measures the expanded host once, then re-locks it.
- Resizes the WebGL framebuffer and recomputes orthographic width from the preserved framed projection height.
- Avoids a host ResizeObserver, renderer remount, or responsive CSS-only stretching.
- Targeted ESLint and whitespace validation pass.
