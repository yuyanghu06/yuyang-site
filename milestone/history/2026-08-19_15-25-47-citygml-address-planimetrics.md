# CityGML, address, and roadbed foundation

Date: 2026-08-19 15:25 PDT

- Downloaded the full official NYC CityGML archive into gitignored `data/raw/` storage.
- Used the included delivery-area index to isolate delivery area 12 and cropped it to 680 meters around Washington Square.
- Created a tracked 9.35 MiB runtime asset with 3,090 buildings, 59,414 roof/wall/ground surfaces, and 293,642 vertices.
- Replaced footprint extrusion in the live scene with the actual CityGML surface geometry.
- Downloaded NYC PAD 26B into ignored storage and built a tracked BIN-based address index: 3,007 matched BINs and 4,152 addresses.
- Pulled 555 official 2022 NYC planimetric roadbed polygons and rendered them for real street shapes and widths.
- Removed the entire procedural park layer at the user's request.
- Changed the fixed camera from a southeast angle to a south-facing view.
- Added `TODO.md`; full upstream files and temporary conversion products stay gitignored while used runtime subsets remain tracked.
- Confirmed ESLint and optimized production build pass.
- Browser-based visual QA remains manual because no browser-control backend was available.
