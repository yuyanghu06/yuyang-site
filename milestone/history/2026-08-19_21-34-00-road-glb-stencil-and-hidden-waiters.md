# Road GLB stencil and hidden waiters

- Added and wired a 421 KiB Meshopt-compressed GLB containing all 1,181 official roadbed polygons, eliminating client road triangulation from the visual path.
- Kept the full planimetrics JSON temporarily for ambient validation only; it no longer constructs or blocks the visible road mesh.
- Restored render order `-1` on every GLB road mesh so stencil writes precede the gray datum and Union no longer exposes white cutouts.
- Made scheduled building/custom roots completely invisible until their spring begins, fixing early protrusion by tall special-color buildings.
- Replaced the flat/glowing arrow with a fully solid extruded and beveled white arrow with visible thickness and no translucent underlay.
- ESLint, TypeScript, and the optimized production build pass.
