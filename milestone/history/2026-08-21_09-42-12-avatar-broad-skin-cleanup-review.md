# Avatar broad skin cleanup review

- Replaced the insufficient dark-pixel-only cleanup with an 11×11 local median across the protected interior of every detected peach skin UV island.
- The v2 texture remains exactly 2048² and preserves UV borders, hair, clothing, and non-skin source pixels; 398,768 pixels inside the broader skin treatment changed.
- Packed the v2 texture into both the avatar material's real base-color and emissive inputs, then exported it directly into the site idle GLB.
- Advanced the loader cache version for live-lighting review.
- Verified the GLB retains the 2048² texture and one three-second idle animation with 162 channels and 1,360 keyframes.
- The authoritative Blender source remains unsaved and no animation video was rerendered.
