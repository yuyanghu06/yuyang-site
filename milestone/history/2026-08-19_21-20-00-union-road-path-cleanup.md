# Union road path cleanup

- Identified the pale bars and junction starbursts as OSM path boxes rendered across official roadbeds.
- Added planimetric roadbed validation to shared park-path construction.
- Every segment is sampled at five points along its length, at its centerline and both full-width edges with a 0.25-meter margin.
- A segment is omitted if any probe enters asphalt; 648 of 1,848 source segments are removed and 1,200 clean off-road segments remain.
- The filter applies consistently to Washington and Union path geometry.
- ESLint, Next route type generation, TypeScript, and `git diff --check` pass.
