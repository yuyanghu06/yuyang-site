# First-paint gray handoff

- Changed the server-rendered map shell to begin the gray datum fade immediately, before client hydration and WebGL initialization.
- Matched the Three.js scene clear color to the CSS datum gray so canvas attachment cannot flash back to white.
- Kept the road-first geometry sequence unchanged.
- Verified ESLint, TypeScript, and the optimized production build.
