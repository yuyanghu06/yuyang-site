# Manhattan roads, parks, and ambient visibility

- Expanded official NYC road coverage from 1,181 to 2,390 polygons and rebuilt an 854 KiB `manhattan-roads.glb` covering the 1,800-meter Manhattan crop.
- Renamed the shared source to `public/data/manhattan-planimetrics.json` and versioned the new road GLB URL/preload to bypass the stale immutable Washington road cache.
- Added a reproducible Manhattan-wide OSM park/path audit and build-time validation. The frozen layout now contains 465 accepted trees across 30 rendered grass park areas; every rendered grass area has at least one accepted tree.
- Increased traffic from 240 to 600 build-validated vehicle routes distributed across the expanded road coverage.
- Kept 600 pedestrians for Washington/Union, but hide them and skip their animation updates in the Manhattan overview.
- Production build, TypeScript, ESLint, and diff checks pass.
