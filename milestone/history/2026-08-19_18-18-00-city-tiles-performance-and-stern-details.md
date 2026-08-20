# City tiles, runtime performance, and Stern/Gould detail pass

- Replaced client-side parsing/triangulation of the 9.4 MiB CityGML JSON with a repeatable generator for 64 spatial Meshopt GLB tiles and a 730 KiB footprint/detail runtime file.
- Added progressive nearest-first tile loading, content-derived cache versions, asset cache headers, abortable requests, adaptive DPR, reduced shadows, 30 FPS idle rendering, off-screen/hidden suspension, render telemetry, and a first-load canvas fade.
- Kept Courant and Stern on authoritative CityGML massing and added Bobst-style facade windows and roof details. Corrected Courant to BIN `1008627`.
- Corrected the Stern red/gray material assignment, added four oversized wall-aligned square rooftop HVAC housings with black fan wells/blades, and added curved rotunda glass plus one downward-hanging purple flag.
- Added lightweight Gould Plaza paving, trees, and seating intended to remain readable in a future close zoom.
- `npm run data:washington-city-tiles`, `npm run lint`, and `npm run build` pass. The existing port-3000 server returned the page, runtime metadata, and a compressed GLB tile successfully; no additional dev server was left running.
