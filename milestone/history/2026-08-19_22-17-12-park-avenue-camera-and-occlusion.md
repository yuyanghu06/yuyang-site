# Park Avenue camera, material, and occlusion handoff

- Changed 235 Park Avenue South to light warm-tan masonry (`#C7AA83`) with a subdued gray-brown roof and retained dark facade windows.
- Rotated its fixed camera 30 degrees counterclockwise from the earlier southwest preset to azimuth `-π/12`, placing the camera south-southwest and looking north-northeast.
- Added close-view sightline occlusion handling. Complete intervening context tile roots and non-selected landmarks are hidden before camera travel and restored when selection ends, changes, or the destination switches.
- Regenerated city tiles after the material-source change.
- ESLint, TypeScript, and the optimized production build pass.
