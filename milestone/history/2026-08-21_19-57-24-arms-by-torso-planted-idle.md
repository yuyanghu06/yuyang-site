# Arms-by-torso planted idle review

Created `public/animations/idle-arms-by-torso-review.glb` from the untouched accepted idle without moving rest joints, mesh vertices, or skin weights.

Neutralized only the shoulder, upper-arm, and forearm animation so the fitted rest chains hang beside the ribcage, then rotated both complete shoulder chains 8° forward. Preserved both hand bones and every finger track. Neutralized the complete leg animation and rotated each thigh inward 4° so the feet remain planted close together without overlap.

Blender 5.1 comparison at frames 0, 15, 30, 45, and 60 finds at most `2.08e-6` local-matrix difference across 26 tracked hand/finger bones. The candidate retains 52 bones, one `Idle_Loop` over frames 0–60, and exact `0.0` full pose-matrix loop closure. It remains unapproved; `idle.glb` is untouched.
