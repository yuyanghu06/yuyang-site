# Idle-based wave review candidate

- Created `assets/blender/yuyang-avatar-wave-hello-review.blend` without overwriting the authoritative avatar source.
- Built `wave_hello_review_v1` on the approved 52-bone exported `Idle_Loop` skeleton used by the website runtime.
- Authored a four-second silent one-shot: right arm lifts, open palm remains beside the head for three restrained wave beats, then the complete pose settles exactly to its starting state.
- Exported the unapproved review asset to `public/animations/wave-hello-review-v1.glb` with the approved embedded face.
- Direct GLB inspection reports one 52-joint skin, two meshes, one finite animation named `wave_hello`, 156 channels, and a duration of exactly four seconds.
- Blender validation reports `0.0` maximum first/last pose-matrix difference across the complete skeleton and `0.0` lower-body bookend drift.
- The candidate is intentionally not wired into the runtime until the user approves its motion and timing.
