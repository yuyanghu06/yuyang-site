# Avatar welded-mesh site review

- Audited the authoritative live Blender source and found 12,393 exact duplicate-position buckets; all duplicates had identical bone weights.
- Created recoverable pre-edit `.blend` and public idle-GLB backups under ignored `data/raw/avatar-mesh-backups-2026-08-21/`.
- In the unsaved live Blender session, welded 13,642 coincident vertices, cleared imported custom split normals, smooth-shaded the connected surface, and retained edges sharper than 55 degrees.
- Rendered full-body and face close-up approval stills before exporting anything.
- Recovered the existing idle Action from the prior public GLB, correctly rebound its Blender 5.1 layered Action slot, and exported the repaired mesh with one verified three-second/162-channel animation.
- Replaced the site idle GLB only for live-lighting review and added an explicit cache version; the authoritative Blender source remains unsaved and no videos were rerendered.
- Targeted ESLint, GLB inspection, and diff validation pass.
