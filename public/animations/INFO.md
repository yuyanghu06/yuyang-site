# Runtime animations

This folder is the permanent public home for exported animation GLBs. All current and future standalone avatar animation clips must live here rather than in `public/models/`.

## Direct subfolders

There are no direct subfolders.

## Direct files

- `idle.glb` is the approved live five-second idle animation. Its embedded `Mesh_0_BaseColor` contains the user's fourth 2026-08-24 Blender Texture Paint revision. A texture-only replacement preserves the prior 55-node structure, 52-joint skin, two meshes, three embedded textures, and 156-channel `Idle_Loop`. It uses the user's manually tuned symmetric open-hand arm placement, holds the hips and complete leg/foot/toe chains numerically fixed, and embeds the illustrated face as a separate 442-vertex mesh skinned exactly 100% to `Head`. The face uses the user's final approved manual transform: location `(-0.000442441, -0.065205455, 0.336710483)`, XYZ Euler rotation `(0.280676663, -0.085589372, 0.202968687)`, and scale `(1.164230943, 1.164231062, 1.164230943)`. Location, rotation, and scale are fully locked, and the exported loop closes at exactly `0.0` pose-matrix delta.
- `wave-hello-review-v2.glb` is the 12 KiB animation-only 2.5-second open-hand wave used for the site's first-load introduction. It retains 19 rotation channels for the approved moving arm chain and contains no duplicate mesh, skin, material, texture, or camera. Runtime rebuilds every locked body channel from the already-loaded idle clip, plays the wave at 1.3× speed, and replaces the moving chain's bookends with exact idle values. Its editable conversion is `/tmp/yuyang-wave-hello-review.blend`.
- `nod-smile.glb` is the 41 KiB animation-only two-second `nod_smile` source. It contains only the `Head` and `neck` rotation tracks; runtime rebuilds locked body tracks from `idle.glb`, while the persistent face supplies the coordinated open smile.
- `head-shake-disappointed.glb` is the 41 KiB animation-only two-second `head_shake_disappointed` source. It contains only the `Head` and `neck` rotation tracks; runtime rebuilds locked body tracks from `idle.glb`, while the persistent face supplies the disappointed eyes and frown.
- `INFO.md` is this authoritative folder inventory and animation-location policy.
