# Current Project Milestone

Last updated: 2026-08-19 15:53 PDT

This is the authoritative rolling project state. Historical session handoffs are stored as timestamped, append-only files in `milestone/history/`.

## Milestone status

The previous multi-scale atlas and Manhattan camera sequence have been retired. The project is restarting from a single Washington Square study so its visual language can be corrected before any broader website structure is rebuilt.

## Current visual direction

- Render Washington Square and its immediate surrounding neighborhood as a restrained 3D miniature.
- Buildings explicitly selected by the user will eventually receive custom recognizable 3D models.
- All other context buildings use the official NYC 2014 CityGML roof, wall, and ground surfaces with a deterministic low-saturation palette led by muted limestone (`#D2C6AF`), pale stone, dusty rose, muted ochre, and occasional sage; the previous near-white base has been removed.
- The hand-built Washington Square Park approximation (green slab, invented paths, fountain, and procedural trees) has been removed.
- The simplified Washington Square Arch remains separate pending a later custom hero model.
- The orthographic camera uses a tighter crop and a 30% lower elevation. Horizontal click/touch dragging rotates around Washington Square; pan, wheel zoom, pinch zoom, and alternate view navigation remain disabled.
- Previous generated style-reference images and the former Manhattan view hierarchy are no longer authoritative for the new implementation.

## Current codebase

- Branch: `map-preview`.
- Framework: Next.js 16, React 19, TypeScript, and Three.js.
- `/` now renders `src/components/nyc-3d-map.tsx` directly.
- `src/components/atlas-map.tsx` has been removed.
- `src/components/nyc-3d-map.tsx` contains one Washington Square scene only.
- `src/app/globals.css` has been replaced with a minimal stylesheet for the single study.
- The initial orthographic camera looks north from directly south of the square, keeping west on the left and east on the right, and can rotate horizontally around the square.
- Lighting now uses a warm illustrated miniature treatment: cream haze, restrained warm hemisphere fill, a soft low-saturation directional key, reduced ACES exposure, and softened shadows.
- Official planimetric roadbeds use a muted charcoal-gray material to make the street network more legible against the warm buildings and ground.
- The top title/instruction overlay has been removed so the map occupies the canvas without a banner.
- A cool gray ground datum sits 0.56 scene units above the dark roadbeds to create a subtle but readable sidewalk curb; authoritative sidewalk polygons remain a later data refinement.
- The WebGL renderer explicitly requests a stencil buffer so the raised sidewalk datum is cut away over official roadbed polygons instead of covering the asphalt.
- Eight low-contrast off-white zebra crossings mark the two adjoining streets at each Washington Square corner. Their centers are verified to fall inside official roadbed polygons so the raised sidewalk mask does not hide them.
- `public/data/washington-square-citygml.json` is a tracked 9.35 MiB crop of official NYC CityGML delivery area 12: 3,090 buildings, 59,414 surfaces, and 293,642 vertices within 680 meters of Washington Square.
- `public/data/washington-square-planimetrics.json` contains 555 tracked roadbed polygons from the official NYC 2022 Planimetric Database, providing measured road shapes and widths.
- `public/data/washington-square-addresses.json` joins current NYC Property Address Directory 26B records to CityGML buildings by BIN: 3,007 matched BINs and 4,152 unique addresses.
- Complete downloads and temporary conversion files are gitignored under `data/raw/` and `data/work/`; only cropped runtime data is tracked.
- Repeatable data scripts are `scripts/extract-washington-citygml.py`, `scripts/build-washington-address-index.py`, and `scripts/build-washington-planimetrics.mjs`.
- `TODO.md` records the later cleanup of obsolete prototypes and local source data after this pipeline stabilizes.
- The old atlas, Manhattan overview, Washington/Union joint view, Union Square view, camera transitions, pins, and interactive camera controls are absent from the runtime.
- ESLint and the optimized production build passed after the lighting, palette, camera, and rotation changes. The subsequent camera-height and road-color adjustments are minimal constant-only changes.
- The working tree contains uncommitted prototype files.

## Next implementation milestone

1. Visually review the warm, rotatable CityGML and planimetric roadbed scene with the user; automated browser capture is unavailable in the current session.
2. Pull authoritative planimetric park, plaza, sidewalk, and path geometry before reintroducing any Washington Square ground treatment.
3. Decide whether to remove the temporary procedural arch until its custom hero model is ready.
4. Have the user identify the first hero building or landmark that should receive a custom 3D model.
5. Refine the new warm material, shadow, road contrast, and background treatment from user feedback.
6. Expand beyond Washington Square only after this small study is approved.
