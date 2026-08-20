# Radial survey shader

- Replaced the dense finite `GridHelper` sheet with a sparse black shader-drawn grid.
- Added a soft circular center-out reveal over 2.6 seconds, removing the visible rectangular boundary.
- Increased marker staging and minimum hold time so fast decoding cannot make the survey animation appear instantaneous.
- Preserved the road-first and building spring sequence.
- Verified ESLint, TypeScript, and the optimized production build.
