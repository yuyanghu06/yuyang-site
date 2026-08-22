# Meshy safe-weld site review

- Follow-up review confirmed that clearing Meshy's custom normal field alone did not remove the broad facial facets.
- Found 3,389 removable exact-position duplicates across 2,839 mesh locations; seven locations had conflicting bone weights.
- Welded only the 3,382 exact duplicates with identical weight signatures and left all seven rig-sensitive conflicts untouched.
- Preserved the UV layer, 15,341 polygons, 54 deform groups, sampled deformation bounds, and exact animation closure; the Blender review source now has 7,992 vertices.
- Re-exported both web GLBs. glTF re-splits to 11,374 runtime vertices at UV/attribute boundaries but retains the averaged normals created by the weld.
- Deployed cache key `20260821-meshy-t2-safe-weld`; idle/talking Blender round-trips, targeted ESLint, whitespace checks, and page/model HTTP checks pass.
