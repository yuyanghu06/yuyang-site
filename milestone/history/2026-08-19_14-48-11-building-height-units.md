# Corrected building height units

Date: 2026-08-19 14:48 PDT

- Corrected the Washington Square renderer to convert NYC `HEIGHT_ROOF` values from feet to meters before extrusion.
- Reduced the fallback minimum height from 10 meters to 3 meters.
- This removes the prior approximately 3.28× vertical exaggeration while leaving the camera and other geometry unchanged.
- Confirmed `npm run lint` and `npm run build` pass.
