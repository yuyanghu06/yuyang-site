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
- `quaternius-vrm-animation-library-2.glb` is the reusable CC0 Quaternius Universal Animation Library 2 Standard source. Its `Yes` action is the source motion for the avatar's thumbs-up review clip.
- `quaternius-vrm-animation-library.glb` is the reusable 46-action Quaternius Universal Animation Library source copied from the pinned VRM Game Starter checkout. It retains the Quaternius asset license.
- `washington-square-arch.glb` is the merged, corrected Washington Square Arch landmark used by the Manhattan renderer.
- `yuyang-voxel-avatar-review-v1.glb` is the unapproved, rigged parameterized voxel-avatar candidate; it is not wired into the runtime.
- `yuyang-voxel-avatar-review-v2.glb` and `yuyang-voxel-avatar-review-v3.glb` are rejected intermediate rigged voxel-avatar exports retained only for review provenance.
- `yuyang-voxel-avatar-review-v4.glb` is the current unapproved rigged voxel-avatar export; it remains disconnected from the runtime pending visual approval.
- `info.md` is this authoritative folder inventory.

Superseded mesh experiments, rig comparisons, recovery rigs, and rejected retarget diagnostics were removed from this public runtime directory on 2026-08-21. The accepted idle mapping checkpoint moved to `../animations/idle.glb`; future standalone animations belong there. Historical findings remain documented in milestone history.
