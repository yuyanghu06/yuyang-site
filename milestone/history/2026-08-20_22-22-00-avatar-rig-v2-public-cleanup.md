# Avatar rig V2 and public cleanup

- Replaced the one-bone-per-digit candidate with a verified 54-bone rig containing three connected deform joints for every finger and thumb while preserving the original neutral mesh.
- Retargeted the standard `Idle_Loop` into `Yuyang_Idle_Loop_v2`; validation confirms non-static motion, exact loop closure, and a clean 54-bone GLB round-trip. Generated the 30 fps review MP4 without the duplicate terminal frame.
- Made `public/models/yuyang-avatar-idle-loop-v2.glb` the only public avatar model and moved all obsolete public avatar GLBs to Trash.
- Moved the explicitly retired `public/photos`, `public/textures`, and `public/branding` folders to Trash. POI markers now use their identical canvas-rendered graphic without external SVG requests.
- Grouped scripts into `scripts/avatar/`, `scripts/map-data/`, and `scripts/previews/`, updating package commands, project-root resolution, and generated-file provenance comments.
