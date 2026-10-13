# Torrey Highlands geographic data

Static, reproducible OpenStreetMap geography for the San Diego view, centered on the user's Camino del Sur / SR-56 screenshot and extending north to Westview High School. All local coordinates are meters, east +X and north −Z, relative to longitude −117.1518, latitude 32.9606.

There are no direct subfolders.

- `source.osm.json` is the compact OpenStreetMap source export with original feature IDs, tagged footprints, roads, landcover, source trees, and Chef Zhu's mapped restaurant point. It is licensed under ODbL 1.0, with attribution to OpenStreetMap contributors.
- `manifest.json` records geographic bounds, projection, source timestamp, Map3D commit, output hash, counts, assumptions, camera framing, merged landmark source IDs, the sage/cream/terracotta palette, and the lossless position-compression contract that preserves surface separation.
- `layout.json` retains projected building/road/tree layout and exclusion polygons for reproducibility and independent geometry-placement audits.
- `MAP3D-LICENSE.txt` preserves the upstream Map3D MIT copyright and license notice.
- `INFO.md` is this folder guide.

Generate with `node scripts/map-data/build-san-diego.mjs`; add `--refresh` only to request a new OSM snapshot. The ignored checkout at `data/work/map3d/` is pinned to commit `2c5d732477ba7c55995572aae926bf80303c00b9`. The generator executes its `Space.tsx` building-extrusion implementation, using metric projection and documented height inputs. Terrain elevation, inferred heights, facade details, and supplemental planting are stylized assumptions; footprints and street layout are mapped data.

Attribution: [OpenStreetMap contributors](https://www.openstreetmap.org/copyright), [ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/), and [Map3D](https://github.com/cartesiancs/map3d).
