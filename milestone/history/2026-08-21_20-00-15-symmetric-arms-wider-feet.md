# Symmetric arms and wider planted feet

Revised `public/animations/idle-arms-by-torso-review.glb` from the previously accepted-in-review arm placement.

Moved the left complete shoulder chain to 16° forward and solved the right shoulder, elbow, and wrist toward mirrored left-side joint positions on every frame, correcting the source rig's asymmetric arm placement. Reduced the inward thigh adjustment from 4° to 2° per side to increase the planted gap between the feet without returning to the original wide stance.

Both hand bones and all finger tracks remain untouched. Blender 5.1 comparison over five frames reports at most `2.08e-6` local-matrix difference across 26 tracked hand/finger bones. The candidate retains 52 bones, one `Idle_Loop` over frames 0–60, and exact `0.0` full pose-matrix loop closure. It remains unapproved; `idle.glb` is unchanged.
