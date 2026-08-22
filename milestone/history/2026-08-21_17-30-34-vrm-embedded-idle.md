# VRM embedded idle and arm-side correction

- Added a reproducible TypeScript baker that samples the production VRM retargeter and embeds `Idle_Loop` onto the avatar's raw skeleton.
- Produced `public/models/yuyang-avatar-vrm1-idle-embedded-review.glb` with one three-second Action, 53 channels, the original textured mesh, one skin, and 52 VRM humanoid bones.
- User inspection found the upper limbs side-swapped while accepting the remainder of the motion.
- Swapped only the complete shoulder-to-fingertip VRM assignments; body and leg mappings remain unchanged.
- Regenerated both the rig-only and embedded-idle GLBs. File-level inspection reports finite nonzero motion and exact first/last sample closure.
- Targeted ESLint and full TypeScript checking pass.
