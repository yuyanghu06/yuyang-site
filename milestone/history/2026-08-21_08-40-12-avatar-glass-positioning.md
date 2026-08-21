# Avatar glass positioning and resize optimization

- Lifted the shared avatar canvas 25% in the fullscreen shell without changing its Three.js camera.
- Preserved the manually tuned minimized horizontal crop and `0.34` scale while lifting the minimized canvas another 2%.
- Kept the liquid-glass surface at the expanded modal dimensions during resize so its displacement map does not regenerate on every transition frame.
- Switched `simple-liquid-glass` to its lower-cost rendering mode while retaining dynamic backdrop-derived blur and lighting.
- Targeted ESLint, TypeScript, and `git diff --check` verification pass.
