# Detailed arch flat top and crosswalk rebuild

- Replaced the malformed/simplified Washington Square Arch export with the original detailed Sketchfab arch geometry.
- Added one thin, mathematically flat stone layer directly over the original Blender crown opening and joined it into the exported object.
- Deleted the simplified corrected Blender copy and removed runtime cap/axis workarounds.
- Verified the GLB is upright in Three.js: X 10.97, Y 13.67, Z 4.34 before runtime normalization.
- Reworked crosswalk extraction to bound it to Washington Square and measure each zebra band's asphalt span from NYC planimetric roadbeds; updated stripe proportions and elevation.
- ESLint passes. The optimized build is currently blocked by an unrelated incomplete CityGML streaming refactor already present in `src/components/nyc-3d-map.tsx` (`WashingtonCityGmlData` and `createLiptonWindows` references).
- Nothing was pushed.
