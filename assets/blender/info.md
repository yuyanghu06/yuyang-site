# Blender sources

This directory contains only the active editable Blender sources for the globe, custom buildings, and avatar.

## Files

- `yuyang-avatar-talking-loop-face-v2.blend` is the only authoritative avatar source. It contains the 54-bone corrected talking loop, the approved animated 2D face canvas, and the saved live-idle rig whose embedded face uses the user's final approved manual placement. Its exact location, XYZ Euler rotation, and scale are fully locked, and all 442 vertices remain weighted exactly 100% to `Head`.
- `lowpoly-earth-watercolor.blend` is the authoritative globe source.
- `nyu-custom-buildings.blend` is the active custom-landmark authoring source.
- `nyu-custom-buildings.blend1` is Blender's recoverable backup of the custom-landmark source.
- `info.md` documents this folder.

There are no direct subfolders. Unused avatar and globe Blender files are archived under ignored `data/raw/`, not kept here.

Landmark detail geometry must be baked or merged with its base building before it becomes selectable or animated.
