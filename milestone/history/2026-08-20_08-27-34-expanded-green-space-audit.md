# Expanded Manhattan green-space audit

- Expanded the Manhattan OSM audit beyond `leisure=park` to include gardens, playgrounds, pitches, recreation grounds, grass, and village greens, covering the additional block-scale voids identified in the overview.
- Increased audited source polygons from 28 to 67.
- Regenerated 494 accepted trees across 54 rendered green/recreation areas; areas that cannot accept a tree without violating geometry constraints remain unrendered as grass.
- Tree acceptance uses 24 boundary probes plus path, official roadbed, CityGML building, and global inter-tree spacing checks at build time.
- Production build, TypeScript, ESLint, and diff checks pass.
