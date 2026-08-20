# Lowered riverbeds beneath the water pop

- Confirmed the main datum is a single plane without a bottom cap; the flicker came from water traveling upward through that plane.
- Stencil-cut the Hudson and East River footprints out of the main land datum.
- Added matching physical riverbed geometry at Y `-18.5`, below the water's full spring path from Y `-17.08` to `0.92`.
- The water can now pop upward without plane crossing or z-fighting.
- Changed the pre-canvas backing to land gray and append the canvas only after rendering its first land/riverbed frame offscreen.
