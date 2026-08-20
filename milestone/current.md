# Current Project Milestone

Last updated: 2026-08-19 17:22 PDT

This is the authoritative rolling project state. Historical session handoffs are stored as timestamped, append-only files in `milestone/history/`.

## Milestone status

The previous multi-scale atlas and Manhattan camera sequence have been retired. The project is restarting from a single Washington Square study so its visual language can be corrected before any broader website structure is rebuilt.

## Current visual direction

- Render Washington Square and its immediate surrounding neighborhood as a restrained 3D miniature.
- Buildings explicitly selected by the user will eventually receive custom recognizable 3D models.
- All other context buildings use the official NYC 2014 CityGML roof, wall, and ground surfaces with a deterministic, higher-depth sun-faded Village palette spanning limestone (`#B9A98D`), sandstone, dusty brick, terracotta, sage, cool gray stone, aged cream, and dark brown-gray. Roofs are lighter and less saturated than their corresponding walls for clearer massing.
- Three verified buildings bypass the procedural palette through BIN-specific overrides: One Fifth Avenue (`1008847`) uses pale weathered gray stone, the NYU Silver Center complex (`1008820`) uses light gray-beige masonry, and Lipton Hall (`1008875`) retains its earlier muted red-brown brick palette. Each has a distinct roof treatment. Lipton additionally carries 447 dark window instances stacked floor-by-floor across 14 eligible CityGML facade faces.
- Washington Square greenery remains intentionally absent. The current park pass renders only hardscape from OpenStreetMap: 134 mapped footway/path/pedestrian segments and the mapped fountain footprint.
- The map now loads `public/models/washington-square-arch.glb`, isolated from the existing Blender Sketchfab scene as nine meshes. All imported materials are overridden with warm white, the model is normalized to the mapped 20.5-meter height, and it uses OSM way `248166269` for its exact north-gate position and rotation. A visibly open procedural model remains only as a load-failure fallback.
- CityGML BIN `1088400` is excluded from context massing because its solid block occupied the same footprint and hid the detailed Blender arch.
- The imported arch material renders double-sided because several Sketchfab cap faces use reversed/single-sided normals; this keeps the upper section visually solid from every camera rotation.
- The Blender arch asset itself is now cut flat at world Z 11.72 and capped with one opaque warm-white slab before GLB export; the earlier runtime overlay cap has been removed.
- Mapped crosswalks use seven clearly separated, unlit warm-white zebra bars with greater length, spacing, thickness, and elevation so the stripes remain individually legible at the map camera distance.
- Crosswalks now come from tagged OSM `highway=crossing` nodes and inherit their orientation from connected footway geometry; all earlier hand-estimated crossing coordinates were removed.
- The downloadable CC BY Sketchfab scene `Washington Square Park v03` by `nyu_grad_alley_2020` is now imported into `assets/blender/nyu-custom-buildings.blend` as the style source for Bobst, Courant, and Stern. Bobst's missing rear wall has been closed with a cleaned mirror of its modeled five-bay front facade, retaining the source masonry, glazing, and opening materials without duplicating side-wall trim.
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
- Lighting now adapts Figma Direction 05 with reduced cool ambient fill, a stronger warm directional key, reduced exposure, firmer soft shadows, and cream haze beginning farther from the foreground to preserve building contrast. Exact token extraction remains blocked by the Figma Starter-plan MCP limit.
- Official planimetric roadbeds use dark brown-gray (`#6F6A61`) to make the street network more legible against the deeper warm buildings and cooler sidewalk datum.
- The top title/instruction overlay has been removed so the map occupies the canvas without a banner.
- A cool gray ground datum sits 0.56 scene units above the dark roadbeds to create a subtle but readable sidewalk curb; authoritative sidewalk polygons remain a later data refinement.
- The WebGL renderer explicitly requests a stencil buffer so the raised sidewalk datum is cut away over official roadbed polygons instead of covering the asphalt.
- Eight low-contrast off-white zebra crossings mark the two adjoining streets at each Washington Square corner. Their centers are verified to fall inside official roadbed polygons so the raised sidewalk mask does not hide them.
- Crosswalks no longer depend on stencil state. Their compact geometry sits at 0.76 scene units, just above the 0.68 sidewalk datum, which guarantees that the paint remains visible over both the asphalt depth and curb edge.
- Lighting remains a single fixed warm daytime treatment; user-local time-of-day lighting has not yet been implemented.
- Clouds are intentionally absent at the current Washington Square zoom level.
- Sixteen small birds are dispersed across independent overhead lanes, including two near-camera lanes that cover the lower-left projection, with animated wing flaps, gentle vertical drift, varied scale and speed, and seamless off-frame wraparound. White birds use the original long-winged silhouette; gray birds use a distinct pigeon model with a rounder body and head, short tan beak, broad wings, and compact tail.
- A deterministic ambient population adds 300 low-detail instanced pedestrians across non-road, non-building ground. Every complete circular walking route is sampled with clearance probes against road and CityGML building footprints before acceptance; walkers use varied clothing, orientation changes, and a subtle bob while remaining only two render draws.
- One hundred low-detail instanced cars use verified straight routes along the principal axes of elongated official roadbed polygons. Center and side probes across every route remain within the source road polygon, outside holes, and clear of CityGML footprints; car geometry is aligned to its travel vector. Exactly every third vehicle is taxi yellow.
- `public/data/washington-square-citygml.json` is a tracked 9.35 MiB crop of official NYC CityGML delivery area 12: 3,090 buildings, 59,414 surfaces, and 293,642 vertices within 680 meters of Washington Square.
- `public/data/washington-square-planimetrics.json` contains 555 tracked roadbed polygons from the official NYC 2022 Planimetric Database, providing measured road shapes and widths.
- `public/data/washington-square-addresses.json` joins current NYC Property Address Directory 26B records to CityGML buildings by BIN: 3,007 matched BINs and 4,152 unique addresses.
- Complete downloads and temporary conversion files are gitignored under `data/raw/` and `data/work/`; only cropped runtime data is tracked.
- Repeatable data scripts are `scripts/extract-washington-citygml.py`, `scripts/build-washington-address-index.py`, and `scripts/build-washington-planimetrics.mjs`.
- `scripts/build-washington-park.mjs` reproducibly crops OSM park paths, the fountain, and the Washington Square Arch footprint into tracked `public/data/washington-square-park.json` under the ODbL.
- `TODO.md` records the later cleanup of obsolete prototypes and local source data after this pipeline stabilizes.
- The old atlas, Manhattan overview, Washington/Union joint view, Union Square view, camera transitions, pins, and interactive camera controls are absent from the runtime.
- ESLint and the optimized production build passed after the lighting, palette, camera, and rotation changes. The subsequent camera-height and road-color adjustments are minimal constant-only changes.
- The working tree contains uncommitted prototype files.

## Next implementation milestone

1. Visually review the warm, rotatable CityGML and planimetric roadbed scene, including the scale, visibility, density, and speed of the dispersed white birds.
2. Visually review the new OSM hardscape alignment and tune path widths/material contrast without adding greenery yet.
3. Build Courant/Warren Weaver Hall and the Stern complex in Blender using Bobst's simplified geometry, material depth, and facade density as the shared style target.
4. Isolate, optimize, export, and georeference the corrected Bobst model from the Blender source, replacing its CityGML shell in the runtime.
5. Refine the new warm material, shadow, road contrast, and background treatment from user feedback.
6. Expand beyond Washington Square only after this small study is approved.
