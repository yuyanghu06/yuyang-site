# Replace survey with mount loader

- Removed the Three.js survey shader, ground grid, tile brackets, and their animation bookkeeping.
- Added a server-rendered mount overlay so loading feedback exists on the browser's first paint rather than waiting for Three.js.
- Added a thin white loading bar with a restrained simulated fill; it completes when the road GLB has mounted.
- The overlay fades into the gray datum as the road spring begins. Road/building/custom-building/bird staging is otherwise unchanged.
- Ensured road-load errors release the mount overlay so the existing error message remains reachable.
- Verified ESLint, TypeScript, and the optimized production build.
