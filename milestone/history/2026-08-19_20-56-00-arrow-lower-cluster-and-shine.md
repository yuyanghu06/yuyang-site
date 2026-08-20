# Arrow lower-cluster placement and shine

- Moved the Washington arrow 300 world units south from `(420, -175)` to `(420, 125)`, retaining its horizontal placement and targeting the lower red-tower cluster in the user's reference.
- Mirrored the Union return marker at `(125, -705)`.
- Added a subtle 1.045× additive pure-white shell around the shaded extruded body to make the arrow shine while preserving its bevel lighting and shadows.
- ESLint, TypeScript, and `git diff --check` pass.
