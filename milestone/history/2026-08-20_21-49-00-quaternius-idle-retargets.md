# Quaternius idle retarget comparison

- Inspected the downloaded CC0 Universal Animation Library Standard GLB and selected `Idle_Loop` plus `Idle_Talking_Loop`.
- Added reproducible retargeting script `scripts/retarget-quaternius-idles.py` with explicit mappings from the library's 65-bone humanoid rig to the avatar's 24-bone Meshy rig.
- Applied mirrored 22° upper-arm corrections after retargeting so both clips retain the arms-at-sides posture and hands alongside the thighs.
- Created `assets/blender/yuyang-avatar-library-idles.blend` and `public/models/yuyang-avatar-library-idles.glb`. The GLB contains exactly `Yuyang_Idle_Quaternius` and `Yuyang_Idle_Talking_Quaternius`.
- Rendered comparable 540×720, 30 fps reviews: `public/style-references/avatar/yuyang-avatar-quaternius-idle.mp4` (2.5 seconds) and `public/style-references/avatar/yuyang-avatar-quaternius-talking-idle.mp4` (2.933 seconds).
- Verified exact loop closure for both Actions: `0.0` maximum first/last pose-bone matrix delta.
- Finger source channels were intentionally omitted because the current avatar has no finger bones.
- Both clips share one target skeleton, so a future runtime Three.js crossfade of roughly 0.25–0.4 seconds can transition between them without a separately authored bridge clip.
