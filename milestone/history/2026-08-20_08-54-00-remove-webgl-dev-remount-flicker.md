# Remove WebGL development remount flicker

- Traced the persistent river flash to React Strict Mode's development-only effect remount rather than the river spring.
- Disabled `reactStrictMode` in `next.config.ts` so the imperative Three.js renderer and scene initialize only once during local development.
- This removes the duplicate renderer/data-request logs and prevents the first canvas/river scene from being torn down in view.
- ESLint, TypeScript, and the optimized production build pass.
