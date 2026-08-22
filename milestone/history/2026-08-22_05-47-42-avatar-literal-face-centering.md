# Literal avatar face centering

- Rejected further visual-only UV shifts after they distorted or clipped the left eye.
- Restored the original UV artwork and solved the evaluated embedded-face mesh bounds onto the head's local X origin.
- Added only 3.5 mm of outward skin clearance so both eyes remain visible without the earlier floating gap.
- Kept the face object's Euler rotation at exact zero and all location, rotation, and scale locks enabled.
- Replaced animated Head yaw/roll with a camera-square pose while retaining a 15° upward pitch, so the chin turns upward without rotating the face sideways to the viewer.
- Saved the authoritative Blender source, re-exported the live five-second `Idle_Loop`, advanced the runtime cache key, and verified exact `0.0` loop closure.
