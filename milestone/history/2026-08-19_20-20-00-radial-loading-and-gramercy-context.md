# Radial loading and Gramercy context

- Converted square switching to one persistent Three.js scene and camera traversal; the History API keeps `/` and `/union-square` URLs without remounting WebGL.
- Added destination-centered radial tile queues with 12 concurrent decodes per ring, cancellation of superseded queues, and disposal of tiles beyond the active neighborhood.
- Added per-tile opacity fade and damped below-ground spring arrival animations.
- Versioned expanded road and park JSON fetches to prevent stale cached crops from appearing beside newly expanded building tiles.
- Fixed OSM node extraction for mixed self-closing/tagged nodes, expanded Union context eastward, and verified the Gramercy Park polygon near local `(970, -791)`.
- Gramercy is context geometry only and has no camera destination.
- ESLint, TypeScript, and the optimized production build pass; both public URLs remain statically prerendered entry points into the shared client scene.
