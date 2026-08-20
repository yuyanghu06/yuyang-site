# Union and Gramercy greenery and crowds

- Rebuilt Union Square's malformed open OSM lawn fragments as one closed outer perimeter, removing the diagonal gray wedge while retaining mapped paths and fixtures.
- Generalized the Washington Square tree generator and added 96 matching deterministic trees across Union Square and Gramercy Park.
- Kept every full canopy inside its park through 24 perimeter probes, a 0.6-meter safety margin, path clearance, and tree-to-tree spacing.
- Expanded the two-draw pedestrian population from 300 Washington-centered walkers to 600 walkers split across Washington and Union neighborhood sampling areas; routes remain road-, building-, fountain-, and tree-cleared.
- Regenerated `public/data/union-square-park.json`; it now contains exactly two closed park rings.
- Verification: `npx tsc --noEmit`, `npm run lint`, and `npm run build` pass. Live visual QA was unavailable because no browser backend was connected in this session.
