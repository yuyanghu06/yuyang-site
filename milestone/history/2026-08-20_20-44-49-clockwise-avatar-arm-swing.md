# Clockwise avatar arm swing

- Corrected the requested arm adjustment axis after visual clarification: both upper arms now swing 10° clockwise around the character's vertical axis while retaining their relaxed downward angle.
- Rendered a three-quarter review at `public/style-references/avatar/yuyang-avatar-arm-swing-review.png` so the forward/back offset is visible.
- Baked the evaluated deformation and overwrote the production static assets at `public/models/yuyang-avatar-arms-down-static.glb` and `assets/blender/yuyang-avatar-arms-down-static.blend`.
- Export remains a single 1.7-meter static mesh with 39,604 faces; website integration remains intentionally pending facial UV/atlas work.
