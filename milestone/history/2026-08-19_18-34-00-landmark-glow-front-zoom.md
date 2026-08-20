# Landmark glow and front-facing zoom

- Removed all interactive landmark line/edge outlines.
- Added a low-opacity additive white surface glow across each complete Bobst, Courant, and grouped Stern geometry target; hover and selection strengthen the glow.
- Kept hover lift at 4.5 scene units but made selected buildings return to their base elevation during camera zoom.
- Reversed the fixed selection camera azimuth so it approaches from the opposite, front-facing side.
- Made baked Courant and Stern materials double-sided so every authoritative CityGML base face remains visible after base/detail merging.
- `npm run lint` and `npm run build` pass.
