# Correct hand-motion retarget

- User review rejected both the claw-like independent-finger deformation and the hand-test branch's A-pose-like default.
- Removed every library finger and thumb channel from the motion test; the ten new custom controls remain neutral and inherit whole-hand motion rigidly.
- Corrected upper-arm composition so imported motion deltas are layered over the mirrored 22° arms-at-sides base rather than the raw rig rest pose.
- Regenerated the isolated hand-motion Blender file, GLB, and both MP4 comparisons in place.
- Frame one now matches the arms-at-sides neutral pose, both Actions retain exact loop closure, and independent-finger tearing is gone.
- Remaining limitation: when the talking clip rotates the rigid wrist toward camera, the original thumb/mitten silhouette reads awkwardly and approaches the thigh. Candidate remains review-only.
