# San Diego runtime model

This folder contains the static generated Torrey Highlands neighborhood model. There are no direct subfolders.

- `torrey-highlands.glb` contains sage-green terrain, richer park greens and dry coastal scrub, cream-stucco buildings with terracotta roofs, real OSM streets and paths, deterministic low-poly trees, and two single-mesh selectable landmarks: Westview High School and Torrey Highlands Plaza. Roads and parking keep distinct paved colors. All landmark facade details and roofs are baked into their corresponding base mesh. The GLB uses Meshopt compression with lossless Float32 positions to preserve centimeter gaps between road, shoulder, landcover, and roof layers. It has no textures or runtime map-service dependency.
- `INFO.md` is this folder guide.

Regenerate with `node scripts/map-data/build-san-diego.mjs`. Source attribution, geographic bounds, exact feature IDs, model hash, counts, projection, and height assumptions live in `public/data/san-diego/manifest.json`. Map data © OpenStreetMap contributors, ODbL; generator uses Map3D under MIT.
