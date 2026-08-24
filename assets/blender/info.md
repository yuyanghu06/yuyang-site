# Blender sources

This directory contains only the active editable Blender sources for the globe, custom buildings, and avatar.

## Files

- `yuyang-avatar-talking-loop-face-v2.blend` is the only authoritative avatar source. It contains the 54-bone corrected talking loop, the approved animated 2D face canvas, and the saved live-idle rig whose embedded face uses the user's final approved manual placement. Its exact location, XYZ Euler rotation, and scale are fully locked, and all 442 vertices remain weighted exactly 100% to `Head`.
- `yuyang-avatar-talking-loop-face-v2.blend1` is Blender's recoverable backup of the authoritative avatar source.
- `yuyang-avatar-wave-hello-review.blend` is the unapproved wave-hello authoring derivative. It preserves the authoritative source and contains `wave_hello_review_v6`, a four-second one-shot built directly from the approved exported idle skeleton. V6 keeps the palm turned outward and the elbow below the shoulder to avoid the low-poly shirt's unrealistic high-arm underarm stretch without adding bones or separating the mesh.
- `yuyang-avatar-wave-hello-review.blend1` is Blender's recoverable backup of the wave-hello authoring derivative.
- `yuyang-voxel-avatar-review-v1.blend` is the editable, unapproved parameterized voxel-avatar candidate generated from the user's 2026-08-22 portrait. It remains separate from the authoritative 54-bone avatar.
- `yuyang-voxel-avatar-review-v2.blend` is the rejected coarse rounded-face iteration; its eyes and expression remained too blocky.
- `yuyang-voxel-avatar-review-v3.blend` is the rejected dense-head iteration whose curved face shell initially occluded its facial features.
- `yuyang-voxel-avatar-review-v4.blend` is the current unapproved voxel-avatar review source with a volumetric dense-grid head, corrected facial depth, wider shoulders, continuous vertical arms, no watch, and articulated block fingers.
- `lowpoly-earth-watercolor.blend` is the authoritative globe source.
- `nyu-custom-buildings.blend` is the active custom-landmark authoring source.
- `nyu-custom-buildings.blend1` is Blender's recoverable backup of the custom-landmark source.
- `info.md` documents this folder.

There are no direct subfolders. Unused avatar and globe Blender files are archived under ignored `data/raw/`, not kept here.

Landmark detail geometry must be baked or merged with its base building before it becomes selectable or animated.
