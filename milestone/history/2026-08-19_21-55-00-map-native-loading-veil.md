# Map-native loading veil

- Replaced both the removed generic loader and the exposed partial gray scene with a server-rendered, text-free SVG street-plan animation.
- The CSS-only road drawing begins before the deferred Three.js chunk runs and remains above trees, pedestrians, crossings, and other partial scene geometry.
- The veil fades only after the preloaded road GLB is decoded, mounted, and queued for its spring, handing off directly to the real construction animation.
- Broadened abort recognition to all error-like `AbortError` values so refresh and React Strict Mode teardown are absorbed reliably.
- ESLint, TypeScript, and the optimized production build pass; `/` remains statically prerendered.
