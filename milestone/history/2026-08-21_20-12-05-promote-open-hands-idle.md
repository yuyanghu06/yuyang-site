# Promoted open-hands idle

Finished and promoted the manually tuned planted idle to `public/animations/idle.glb` for the live FaceTime avatar.

The final clip bakes the user's arm and forearm adjustments across every frame, keeps the arms symmetric beside the torso, preserves the planted close stance, and holds both hand bones plus all 30 finger joints in their fitted open neutral orientations. The hands now hang parallel to the torso instead of forming angled fists.

Blender 5.1 validation retains 52 bones, the runtime `Head` attachment, one `Idle_Loop` over frames 0–60, at most `2.39e-7` neutral hand/finger matrix drift, and exact `0.0` full loop closure. Updated the browser cache key to `20260821-approved-open-hands-planted-idle`; the existing face canvas remains attached at runtime. Removed the superseded review filename after promotion.
