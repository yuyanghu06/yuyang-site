# Rig original avatar hand mesh

- User rejected the procedural replacement hands and explicitly requested bones in the untouched original generated hand geometry.
- Removed the replacement-hand script and isolated its unapproved Blender/GLB outputs under ignored `data/work/rejected-fixed-hands-2026-08-20/`.
- No specialized hand-rigging skill exists in the local, curated, or experimental catalogs; used the installed `blender-animation-rigging` skill with the repository `blender-avatar-authoring` workflow.
- Added `scripts/rig-yuyang-original-hands.py` and generated `assets/blender/yuyang-avatar-hand-rig-v1.blend` plus `public/models/yuyang-avatar-hand-rig-v1.glb`.
- Added ten deform bones to the original mesh: thumb, index, middle, ring, and pinky for each hand. The avatar armature now has 34 bones.
- Assigned blended weights from the original hand surface without changing topology or replacing geometry.
- Neutral evaluated geometry changed by at most `0.000000273`, effectively floating-point noise, so the original hand silhouette and existing idles remain visually unchanged.
- Verified the GLB round-trip retains all ten new bones and both `Yuyang_Idle_Quaternius` and `Yuyang_Idle_Talking_Quaternius` Actions.
- Status: structural rig candidate only. Finger/thumb deformation still requires a controlled pose review before any gesture animation is authored.
