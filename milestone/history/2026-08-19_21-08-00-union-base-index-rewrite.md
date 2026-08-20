# Union Square base-index rewrite

- Removed the duplicate `src/app/union-square/page.tsx` route implementation.
- Added a masked Next.js rewrite from `/union-square` to `/`, preserving the public URL while serving the static base index.
- The shared client scene now derives its initial Washington/Union destination from `window.location.pathname`.
- Existing `history.pushState` switching still preserves the WebGL renderer, Three.js scene, decoded-tile memory cache, distance-based tile eviction, and immutable browser cache.
- Both `/` and `/union-square` return HTTP 200 from the live dev server.
- ESLint, regenerated Next route types, TypeScript, and `git diff --check` pass.
