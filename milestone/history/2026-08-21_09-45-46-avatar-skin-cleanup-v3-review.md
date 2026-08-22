# Avatar skin cleanup v3 review

- Expanded the protected skin-island mask with a 24-pixel morphological close so longer cheek and neck artifacts no longer interrupt the treated region.
- Increased the local median from 11×11 to 15×15 while retaining a three-pixel protected inset from UV borders.
- The exact 2048² v3 atlas changes 410,692 source pixels inside the skin treatment while preserving hair, clothing, and non-skin regions.
- Packed v3 into the actual avatar material, exported it into the site idle GLB, and advanced the loader cache version.
- Verified the GLB retains its 2048² embedded texture and one three-second idle animation with 162 channels and 1,360 keyframes.
- The authoritative Blender source remains unsaved and no animation video was rerendered.
