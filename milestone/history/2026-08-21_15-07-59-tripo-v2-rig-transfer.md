# Tripo V2 skeleton transfer

The user approved the Tripo Smart Low-Poly surface and authorized a complete skeleton fit without intermediate approval gates.

The original connected Tripo quad FBX was uniformly matched to the authoritative avatar's 1.7-unit height, then received nearest-surface interpolated weights from the evaluated frame-one V2 avatar. The transferred rig preserves the definitive 54-bone hierarchy, including all 30 three-joint finger bones. A localized anatomical cleanup removed false arm-chain weights from 459 central sweater vertices before final normalization.

The editable review source is `assets/blender/yuyang-avatar-tripo-quad-50k-rig-review.blend`; the inspection export is `public/models/yuyang-avatar-tripo-quad-50k-rig-review.glb`. The GLB round trip contains 54 bones, 54 matching deform groups, complete weight coverage, both `Yuyang_Idle_Loop_v2` and `Yuyang_Talking_Loop_v2`, finite sampled deformation, and exact talking-loop closure with `0.0` maximum frame-1/frame-89 vertex delta. Front, side, and back views at frames 1 and 45 are in `public/style-references/avatar/yuyang-avatar-tripo-quad-50k-rig-contact-sheet.png`.

This remains a visual-review candidate and does not replace the authoritative Blender source or deployed site GLBs without explicit user approval.
