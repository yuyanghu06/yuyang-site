# Map-data pipeline

These scripts generate tracked road, park, waterfront, ambient-layout, address, and CityGML runtime assets. Preserve deterministic placement, local coordinate systems, road/footprint validation, content versions, and merged interactive landmark geometry. Run only the generator needed during iteration.

## Direct files

- `build-ambient-layout.mjs` generates validated deterministic New York vegetation and ambient placement.
- `build-hudson-waterfront.mjs` derives Hudson waterfront geometry.
- `build-manhattan-model-data.mjs` prepares the Manhattan overview model dataset.
- `build-manhattan-parks.mjs` prepares Manhattan park polygons.
- `build-nyc-data.mjs` acquires and transforms lower Manhattan geographic data.
- `build-san-diego.mjs` generates static Torrey Highlands geography and GLB assets using the ignored upstream Map3D checkout and public geographic sources. Its palette uses sage terrain, richer park greens, dry coastal scrub, cream stucco, and terracotta roofs, while roads and parking retain paved colors. Source provenance, projection assumptions, and the exact palette accompany its outputs; ordinary regeneration reuses the checked-in source snapshot.
- `build-union-square-park.mjs` prepares Union Square park geometry.
- `build-washington-address-index.py` generates the address-to-building index.
- `build-washington-city-tiles.mjs` generates tiled CityGML runtime meshes and manifests.
- `build-washington-park.mjs` prepares Washington Square park geometry.
- `build-washington-planimetrics.mjs` transforms planimetric road and hardscape polygons.
- `build-washington-road-glb.mjs` bakes and compresses the Manhattan roadbed GLB.
- `extract-washington-citygml.py` extracts Washington Square building surfaces from CityGML.
- `info.md` is this folder's guide.

New York assets retain the Washington Square origin. San Diego assets use their own documented metric projection and are generated independently. The Map3D checkout and downloaded intermediates remain under ignored `data/work/`; production loads only checked-in generated assets.
