# Flat-face rig site corrections

- Regenerated a strict flat-face multiview Meshy 7 surface, remeshed its topology before retexturing, and transferred the complete V2 rig and animations.
- Both site GLBs retain 54 bones, all 30 three-joint finger bones, 54 deform groups, 31,319 polygons, and one intended idle or talking Action.
- The first 18° correction was visibly inadequate in site review and was superseded before final handoff. The deployed pass uses a mirrored 40° local upper-arm correction so the hands rest beside the torso without removing downstream forearm, wrist, hand, or finger animation.
- Grew a hair selection from black source polygons into adjacent dark/tan-contaminated polygons and assigned all 15,278 reached faces a dedicated rough near-black material.
- Restored the old approved facial atlas at its original scale and Y `1.44`; a temporary Y `1.36` placement was rejected as too low and reverted.
- Deployed the corrected GLBs behind cache key `20260821-flat-face-visible-fix-v2`; the authoritative Blender source remains unchanged pending visual approval.
