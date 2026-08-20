# Union as internal index state

- Removed the `/union-square` rewrite from Next configuration.
- Removed all pathname and query-string selection logic.
- Union Square now exists solely as an internal destination within the persistent `/` Three.js scene.
- Arrow traversal keeps the URL at `/` and uses lightweight history state for back/forward camera changes.
- Verified ESLint, TypeScript, the optimized production build, and that only `/` is emitted as the application route.
