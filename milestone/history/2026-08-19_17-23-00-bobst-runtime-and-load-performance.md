# Bobst runtime and load-performance repair

- Exported corrected Bobst from Blender to `public/models/bobst-library.glb` and replaced CityGML BIN `1008626` with the custom model plus a load-failure fallback.
- Aligned Bobst to the long Washington Square South facade edge after the irregular footprint PCA produced a visibly over-rotated result.
- Diagnosed the stalled page as brute-force pedestrian and traffic clearance validation performing up to billions of point-in-polygon checks against the full CityGML footprint list.
- Added a 64-meter spatial footprint index for route probes.
- Replaced deprecated Three.js `Clock` and `PCFSoftShadowMap` usage with `Timer` and `PCFShadowMap`.
- Added structured client load milestone logging for future performance diagnosis.
- Verified page, Bobst GLB, and CityGML responses on a fresh port-3100 development server; lint and optimized production build pass.
- Added the future personal-name SEO blog to `TODO.md`.
