# Union Square shared city crop

- Added a statically prerendered `/union-square` view and reciprocal top-center arrow navigation to `/`.
- Reused the shared NYC CityGML building IDs and BIN-hashed palette, keeping colors stable between square views.
- Added reproducible Union Square OSM park/path data and suppressed Washington-only arch, fountain, trees, and custom landmarks in the Union scene.
- Expanded the same official CityGML delivery-area crop from 680 m to 1,250 m to fill the Union view's northern edge: 8,874 buildings, 174,841 surfaces, and 863,828 vertices.
- Regenerated 186 Meshopt GLB tiles, expanded planimetrics to 1,181 roadbeds, and rebuilt the PAD address join to 8,530 BINs / 11,763 addresses.
- Preserved the optimized runtime pipeline; each view loads only tiles within 900 m of its own center, nearest-first in batches of six, and Union skips all Washington landmark construction.
- ESLint, TypeScript, and the optimized Next.js production build pass; `/` and `/union-square` are static routes.
