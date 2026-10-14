# Map-data pipeline

These scripts generate tracked road, park, waterfront, ambient-layout, address, and CityGML runtime assets. Preserve deterministic placement, local coordinate systems, road/footprint validation, content versions, and merged interactive landmark geometry. Run only the generator needed during iteration.

## Direct files

- `build-ambient-layout.mjs` generates validated deterministic New York vegetation and ambient placement.
- `build-hudson-waterfront.mjs` derives Hudson waterfront geometry.
- `build-manhattan-model-data.mjs` prepares the Manhattan overview model dataset.
- `build-manhattan-parks.mjs` prepares Manhattan park polygons.
- `build-nyc-data.mjs` acquires and transforms lower Manhattan geographic data.
- `build-san-diego.mjs` generates static Torrey Highlands geography and GLB assets using the ignored upstream Map3D checkout and public geographic sources. Its palette uses sage terrain, richer park greens, dry coastal scrub, cream stucco, and terracotta roofs, while roads and parking retain paved colors. Source provenance, projection assumptions, and the exact palette accompany its outputs; ordinary regeneration reuses the checked-in source snapshot. It emits overview zoom 0.5 and a 240-meter northward target shift to keep Westview, the plaza, and Mesa Verde in view, matching the checked-in manifest. Mesa Verde’s reference-based north-south oval track, green infield, and athletics lawn are baked into the selectable Mesa Verde mesh as adjacent surfaces with holes to avoid stacking additive glow inside the track; its field excludes supplemental trees. All four landmark complexes are removed from the background building batch and merged with their roof/facade details into individual selectable roots. The manifest records each school’s mapped source IDs, merged bounds, and camera preset. School-specific detailing adds cream stucco, subdued roof colors, roof-edge trim, height-relative framed windows, fully contained vents, doors and supported entrance canopies to the seven Mesa Verde and twelve Deer Canyon mapped buildings. Verified open campus areas receive modest courts, paths, supported shade structures and seating; Deer Canyon also receives a play surface. These artistic approximations merge into each school root and publish exact placements/counts in manifest and layout metadata. Concave-safe footprint checks reject roof, parcel, building and road conflicts; every authored ground footprint excludes trees.
- `build-union-square-park.mjs` prepares Union Square park geometry.
- `build-washington-address-index.py` generates the address-to-building index.
- `build-washington-city-tiles.mjs` generates tiled CityGML runtime meshes and manifests.
- `build-washington-park.mjs` prepares Washington Square park geometry.
- `build-washington-planimetrics.mjs` transforms planimetric road and hardscape polygons.
- `build-washington-road-glb.mjs` bakes and compresses the Manhattan roadbed GLB.
- `extract-washington-citygml.py` extracts Washington Square building surfaces from CityGML.
- `info.md` is this folder's guide.


New York assets retain the Washington Square origin. San Diego assets use their own documented metric projection and are generated independently. The San Diego bounds now span longitude −117.167 to −117.13425 and latitude 32.948 to 32.9755, increasing width by 31% and height by 37.5% while retaining the authored camera and origin. Its expanded source combines the original reviewed records with new perimeter records from four smaller OSM map API exports; source provenance records both acquisitions. Cached snapshots must cover the requested bounds or generation fails with a `--refresh` instruction; undersized legacy XML is skipped. The Map3D checkout and downloaded intermediates remain under ignored `data/work/`; production loads only checked-in generated assets.
