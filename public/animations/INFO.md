# Runtime animations

This folder is the permanent public home for exported animation GLBs. All current and future standalone avatar animation clips must live here rather than in `public/models/`.

## Direct subfolders

There are no direct subfolders.

## Direct files

- `idle.glb` is the approved live five-second idle animation. It uses the user's manually tuned symmetric open-hand arm placement, holds the hips and complete leg/foot/toe chains numerically fixed, and embeds the illustrated face as a separate 442-vertex mesh skinned exactly 100% to `Head`. The face uses the user's final approved manual transform: location `(-0.000442441, -0.065205455, 0.336710483)`, XYZ Euler rotation `(0.280676663, -0.085589372, 0.202968687)`, and scale `(1.164230943, 1.164231062, 1.164230943)`. Location, rotation, and scale are fully locked, and the exported loop closes at exactly `0.0` pose-matrix delta.
- `INFO.md` is this authoritative folder inventory and animation-location policy.
