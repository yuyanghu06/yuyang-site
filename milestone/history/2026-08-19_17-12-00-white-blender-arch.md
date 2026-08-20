# White Blender arch

- Used the connected Blender MCP scene and found nine arch meshes under `ARCH_NM_2_134`.
- Replaced their original materials with a single warm-white rough material and exported only those meshes to `public/models/washington-square-arch.glb` (32 KB).
- Added GLTF loading to the map, with a runtime white-material override, 20.5-meter height normalization, and OSM-derived position/rotation.
- Retained the procedural open arch only as an asset-load failure fallback.
- Changes remain local and were not committed or pushed.
