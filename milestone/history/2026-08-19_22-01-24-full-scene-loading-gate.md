# Full-scene loading gate

- Changed the temporary direct-to-Washington loading gate from roads-ready to complete-scene-ready.
- The SVG loading screen now covers all partial geometry until active city tiles, planimetric routes, pedestrians, traffic, custom landmarks, birds, and navigation are mounted and a complete WebGL frame has rendered.
- Load failures release the veil so the existing diagnostic message is visible instead of leaving an apparently frozen loader.
- Removed 3.15 seconds of artificial staging waits that were no longer visible behind the blocking gate.
- The gate can later be reused for a temporary plot-view switch, while the documented final architecture still uses one initial blocking load followed by camera-transition preloading.
- ESLint, TypeScript, and the optimized production build pass.
