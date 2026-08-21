# Blank 2D-face avatar base

- Approved the first generated hybrid-avatar concept: dimensional hair/body with a cohesive illustrated 2D face.
- Rejected further work on topology-driven eyes, eyelids, brows, nose, and mouth; the complete face will now be a unified 2D animation layer.
- Preserved the approved concept at `public/style-references/avatar/yuyang-avatar-2d-face-approved-concept.png`.
- Created `assets/blender/yuyang-avatar-2d-face-base.blend` from the untouched rigged Meshy body.
- Added the curved, blank `Yuyang_BlankFace_Canvas`, rigidly weighted to the Head bone with 775 vertices, 720 quads, and a full 0..1 `Face2D_UV` layout.
- Exported the rig, body, and blank canvas together as `public/models/yuyang-avatar-2d-face-base.glb` (about 9.0 MiB). The first 34 KiB canvas-only export was detected and replaced.
- Next: visually refine canvas silhouette/material at close range, then create neutral/blink/talking 2D face states before wiring anything into the site.
