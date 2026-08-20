# Progressive scene reveal

- Removed the white determinate loading-screen component, its CSS, and both dynamic-shell and mounted-scene gates.
- The matching gray base datum is visible immediately while the client map bundle and renderer initialize.
- Road, city-tile, and ambient preparation now overlap, while visibility is explicitly gated into base/water, roads, buildings, and ambient phases.
- Added shoreline-anchored horizontal fill entrances for the Hudson/East River water surfaces, plus spring entrances for Pier 40, mapped East River piers, park grass, paths, trees, and fountain.
- Added deterministic per-instance rise/stagger entrances for the 600 cars and 600 pedestrians.
- Ambient sky objects remain hidden until the final reveal; the common arrival helper now preserves authored elevations so clouds and planes appear at their correct initial position.
- `npm run lint` and `npm run build` pass. Browser-controlled visual QA was unavailable in this session, so a hard-refresh timing review remains the next visual check.
