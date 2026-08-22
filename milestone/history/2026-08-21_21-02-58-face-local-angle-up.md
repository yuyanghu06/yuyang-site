# Face local angle up

Follow-up review clarified that the facial mesh itself also needed an angle change, not only the animated Head bone. The transform lock was temporarily released, the face's local X angle was reduced from `16.72°` to `12.72°` for a 4° upward tilt, and the rotation lock was restored without changing position or scale.

The authoritative Blender source was saved and `public/animations/idle.glb` re-exported. Validation retains one five-second `Idle_Loop`, exact `0.0` loop closure, a skinned 442-vertex face mesh, and the existing 52-joint skin. The loader cache key is `20260821-face-local-angle-up-slow-idle`.
