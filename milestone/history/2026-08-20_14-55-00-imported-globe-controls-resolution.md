# Imported globe controls and resolution

- Replaced the procedural globe presentation with the recolored Sketchfab low-poly Earth GLB.
- Subdivided and reprojected the ocean mesh to about 1,280 flat facets, increasing the GLB from 271 KiB to 366 KiB.
- Raised Chrome renderer density to as much as 2× DPR with a 1.5× adaptive floor.
- Added map-style mouse, trackpad, one-touch, two-touch orbit, and pinch handling; interactions bypass the 30 FPS idle throttle.
- Moved the base camera 30% farther out and gated inward zoom to the NYC destination with blocked-zoom feedback elsewhere.
- Corrected the model's 90-degree longitude registration for the fixed NYC marker.
- Rebuilt the isolated yellow-facet Blender preview from transformed geographic coordinates so warm facets are restricted to real desert belts; the website keeps uniform green land.
- `npm run lint`, `npx tsc --noEmit`, and `npm run build` pass.
