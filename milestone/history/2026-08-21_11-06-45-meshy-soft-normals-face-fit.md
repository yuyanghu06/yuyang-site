# Meshy soft-normal and face-fit review

- User review found the first deployed Meshy T2 surface too faceted and the attached 2D face oversized and high.
- Cleared Meshy's imported custom normal field and marked every polygon smooth without changing mesh geometry, weights, bones, or Actions.
- Re-exported and round-trip validated both idle and talking GLBs with 54 bones, all 30 finger bones, 54 deform groups, one intended Action, and the 4096² texture.
- Normalized runtime roughness from `2.5` to `1.0`.
- After the first reduced face pass proved too small, set the current canvas to `0.19 × 0.236` world units at Y `1.405` and centered it on X `0` so the illustrated nose aligns with the generated nose.
- Updated the cache key to `20260821-meshy-t2-soft-normals-face-fit`; targeted ESLint, whitespace, page HTTP, and model HTTP checks pass.
