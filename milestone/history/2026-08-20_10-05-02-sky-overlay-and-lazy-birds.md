# Sky overlay and lazy birds

- Moved clouds and passenger planes into a dedicated overlay scene rendered after the city with a cleared depth buffer, eliminating building, pier, and water clipping artifacts.
- Added a neutral hemisphere and directional light rig to the overlay and restored a white flat-shaded cloud material, keeping clouds bright while retaining faceted texture.
- Kept plane bodies unlit pure white so they do not inherit the earlier gray overlay cast.
- Split neighborhood bird creation from Manhattan sky creation. Base Manhattan now creates no bird geometry/materials; birds instantiate only on first entry into Washington or Union and are retained afterward.
- Confirmed `npm run lint` and `npm run build` pass.
