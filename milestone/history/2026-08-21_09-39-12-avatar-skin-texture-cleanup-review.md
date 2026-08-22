# Avatar skin texture cleanup review

- Confirmed the remaining small black marks are baked into the packed 2048² base-color texture rather than caused by mesh gaps or normals.
- Used the built-in image-editing workflow for a cleanup candidate, then rejected it because its 1254² output changed the required resolution and visibly regenerated UV boundaries.
- Applied a deterministic repair to the original atlas instead: only 1,935 pixels (0.046%) changed, restricted to dark marks enclosed inside detected peach skin regions and filled from the local median.
- Replaced both actual base-color and emissive texture inputs with the cleaned packed image; no overlay or additional render layer was added.
- Exported the updated idle GLB into the site and advanced its cache version for live-lighting review.
- Verified the GLB retains a 2048² embedded texture and one three-second idle animation with 162 channels and 1,360 keyframes.
- The authoritative Blender source remains unsaved and no animation video was rerendered.
