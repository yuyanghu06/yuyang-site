# Manual face lock and chin-up gaze

The user manually positioned `Yuyang_EmbeddedFace` in Blender and approved that fit. Its exact object location, quaternion rotation, scale, and depth were preserved; location, rotation, and scale are locked, and all 442 exported face vertices retain total `Head` influence `1.0`. The authoritative `assets/blender/yuyang-avatar-talking-loop-face-v2.blend` was saved with an explicit attachment-policy marker requiring future faces to be manually fitted and approved before locking.

The idle was slowed to 50% speed by doubling its duration from 2.5 to 5 seconds. The final review then moved the face 4 mm toward avatar-right and baked a restrained 4° upward local-X Head pitch across all 76 keyed samples so the chin and gaze address the camera more directly.

The promoted `public/animations/idle.glb` contains two skinned meshes, one 52-joint skin, the five-second 156-channel `Idle_Loop`, exact `0.0` loop closure, zero fixed-lower-body drift, and no face vertex with non-Head influence. The loader cache key is `20260821-face-right-chin-up-slow-idle`.

Full-screen framing remains at 225% of the original scale and settles at an 83%-of-height vertical camera target after the requested 5% upward adjustment. Targeted ESLint, TypeScript, GLB structure, weighting, duration, loop, and whitespace checks pass.
