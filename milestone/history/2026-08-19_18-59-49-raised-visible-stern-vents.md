# Raised visible Stern vents

- Fixed Stern vent placement by ranking roof surfaces with true polygon area instead of bounding-box area; the broad occupied roof now wins over the thin parapet polygon.
- Raised each complete gray-housing-plus-black-top assembly to 0.75 scene units above the roof datum for greater visibility.
- Preserved the four validated roof positions and single-mesh Stern interaction bake.
- Verified with `npm run lint` and `npm run build`; both pass.
