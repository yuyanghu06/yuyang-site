# Runtime 3D models

This folder contains web-served 3D models and reusable external motion sources. Standalone exported animation clips live in `../animations/`, Blender authoring sources live under `assets/blender/`, and generated Manhattan tiles live under `washington-city/`.

## Direct subfolders

- `washington-city/` contains generated, tiled CityGML geometry plus its browser manifests and runtime data.

## Direct files

- `.DS_Store` is macOS Finder metadata.
- `bobst-library.glb` is the corrected Bobst Library landmark model used by the Manhattan renderer.
- `low-poly-planet-earth-e54e8607.glb` is the active globe model loaded by the persistent map runtime.
- `manhattan-roads.glb` is the generated Meshopt-compressed Manhattan roadbed mesh.
- `quaternius-idle-loop-reference.glb` isolates the untouched Quaternius mannequin and its original three-second `Idle_Loop` for mapping comparison.
- `quaternius-vrm-animation-library.glb` is the reusable 46-action Quaternius Universal Animation Library source copied from the pinned VRM Game Starter checkout. It retains the Quaternius asset license.
- `washington-square-arch.glb` is the merged, corrected Washington Square Arch landmark used by the Manhattan renderer.
- `info.md` is this authoritative folder inventory.

Superseded mesh experiments, rig comparisons, recovery rigs, and rejected retarget diagnostics were removed from this public runtime directory on 2026-08-21. The accepted idle mapping checkpoint moved to `../animations/idle.glb`; future standalone animations belong there. Historical findings remain documented in milestone history.
