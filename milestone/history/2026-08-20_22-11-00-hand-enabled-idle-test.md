# Hand-enabled Quaternius idle test

- User requested both library idles with hand movement re-enabled after adding ten custom controls to the original hand mesh.
- Added `scripts/retarget-quaternius-idles-with-hands.py`, which creates an isolated test branch and leaves the collision-safe locked-arm Actions untouched.
- Re-enabled source clavicle, upper-arm, forearm, wrist, whole-hand, thumb, index, middle, ring, and pinky channels on the 34-bone avatar.
- Corrected a 24/30 FPS source interpretation mismatch discovered during the first interrupted test render.
- Generated `assets/blender/yuyang-avatar-hand-motion-test.blend`, `public/models/yuyang-avatar-hand-motion-test.glb`, `public/style-references/avatar/yuyang-avatar-quaternius-idle-hands-test.mp4`, and `yuyang-avatar-quaternius-talking-idle-hands-test.mp4`.
- Verified the exported GLB retains all 34 bones, exactly two named hand-enabled Actions, and exact loop closure.
- Visual result: the custom bones prevent the former catastrophic split, but the strongest talking gesture still creates a noticeable splayed right-hand pose. Candidate remains review-only.
