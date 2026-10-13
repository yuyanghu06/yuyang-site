# Map-data pipeline

These scripts generate tracked road, park, waterfront, ambient-layout, address, and CityGML runtime assets. Preserve deterministic placement, local coordinate systems, road/footprint validation, content versions, and merged interactive landmark geometry. Run only the generator needed during iteration.

## Direct files

- `build-ambient-layout.mjs` generates validated deterministic New York vegetation and ambient placement.
- `build-hudson-waterfront.mjs` derives Hudson waterfront geometry.
- `build-manhattan-model-data.mjs` prepares the Manhattan overview model dataset.
- `build-manhattan-parks.mjs` prepares Manhattan park polygons.
- `build-nyc-data.mjs` acquires and transforms lower Manhattan geographic data.
- `build-san-diego.mjs` generates static Torrey Highlands geography and GLB assets using the ignored upstream Map3D checkout and public geographic sources. Its palette uses sage terrain, richer park greens, dry coastal scrub, cream stucco, and terracotta roofs, while roads and parking retain paved colors. Source provenance, projection assumptions, and the exact palette accompany its outputs; ordinary regeneration reuses the checked-in source snapshot.
- `build-san-diego-region.mjs` expands San Diego from Solana Beach/Fairbanks Ranch to UCSD/Miramar and east through Carmel Mountain/Scripps Ranch. It emits a separate coast-and-canyon GLB, district cameras, a compact creek waterfall with low grounded rock outcrops and a static annotation, audit layout, source-coverage rectangle and measured content-height range without modifying the original Torrey Highlands assets. Torrey Pines has a localized, deliberately enlarged coastal mountain and an oblique camera; its warm cliff facets and all existing map layers use the same terrain grid. Buildings have terrain-following foundations and level roofs; roads taper into bridges and the original patch. Landcover retains the original semantic palette, and planting excludes mapped buildings, streets, water and recreation surfaces. Use `npm run data:san-diego-region`; ordinary builds are offline.
- `san-diego-region-source.mjs` acquires the expansion's real OSM coastline, water, road, landcover, and building records as an attributed, reduced gzip snapshot. Explicit `--refresh` downloads bounded tiles, splits exports exceeding the node limit, and obeys service retry delays. Temporary XML tiles live under `/tmp/yuyang-san-diego-region/`.
- `san-diego-region-geometry.mjs` provides metric projection, shared-grid surface triangulation, foundation-edge subdivision, geometry merging, and exact rectangular clipping around the original Torrey Highlands patch. It joins the mapped mainland coastline and preserves closed tidal islands; scanline clipping supports multiple shoreline crossings through estuaries without connecting opposite banks. Landcover and road triangles match the base terrain planes, including the exact original perimeter; semantic surface heights prevent differently colored polygons from fighting at the same depth. Supplemental terrain, trees, and waterfall scenery are explicitly stylized.
- `build-union-square-park.mjs` prepares Union Square park geometry.
- `build-washington-address-index.py` generates the address-to-building index.
- `build-washington-city-tiles.mjs` generates tiled CityGML runtime meshes and manifests.
- `build-washington-park.mjs` prepares Washington Square park geometry.
- `build-washington-planimetrics.mjs` transforms planimetric road and hardscape polygons.
- `build-washington-road-glb.mjs` bakes and compresses the Manhattan roadbed GLB.
- `extract-washington-citygml.py` extracts Washington Square building surfaces from CityGML.
- `info.md` is this folder's guide.

New York assets retain the Washington Square origin. San Diego assets use their own documented metric projection and are generated independently. The Map3D checkout and downloaded intermediates remain under ignored `data/work/`; production loads only checked-in generated assets.
