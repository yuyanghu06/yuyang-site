# Avatar runtime optimization

Before this pass, the current avatar work was production-built, committed as `f4ce7ea`, and pushed to `origin/washington-square-dev` at the user's request.

OS process sampling found two separate Chrome renderer processes at roughly 621 MiB each and a shared GPU process near 172 MiB. The avatar asset itself is an 8 MiB GLB with 35,153 vertices, 118,812 indices, and one 2048×2048 PNG; it cannot independently account for the observed 1.1 GiB total. Multiple live map-heavy renderer tabs were the dominant source. The full-surface liquid-glass SVG/backdrop pipeline nevertheless contributed meaningful compositor pressure and caused the end-of-transition hitch.

The `simple-liquid-glass` dependency and SVG displacement tree are removed. One stable CSS surface now supplies the same selected 12 px blur, 105% saturation, and translucent color throughout expanded, moving, and docked states, so there is no filter mount or activation boundary. The modal's original dimensions, centering, and avatar framing remain unchanged.

The avatar WebGL path is capped at 30 FPS and 1.5× DPR instead of 60 FPS and 2× DPR, reducing Retina framebuffer pixels by about 44% and halving steady animation renders. It suspends completely while the document is hidden. GLB and face-atlas requests now run concurrently, and Three.js asynchronously compiles the complete scene before the first visible render to avoid a shader-compilation hitch when the avatar appears.

After hot reload and settling, the two previously leading Chrome renderer processes measured about 366–371 MiB. Targeted ESLint, TypeScript, diff-integrity checks, and the full optimized production build pass.
