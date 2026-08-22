# Avatar retargeting contract and source cleanup

- Preserved `yuyang-avatar-vrm1-idle-direction-arms-original-hands-torso-corrected-review.glb` as the accepted mapping checkpoint for future small adjustments.
- Expanded `docs/avatar-animation-system.md` into a fresh-session source of truth covering the exact upstream library commit, local source/reference assets, permanent bone-mapping rules, animation-specific tuning boundary, rejected approaches, and mandatory GLB/X-ray/deformation validation.
- Added the retargeting contract to `AGENTS.md` so future sessions must read and preserve it.
- Removed six obsolete avatar review Blender files from the active `assets/blender/` directory and moved them into the ignored recovery archive. The authoritative `yuyang-avatar-talking-loop-face-v2.blend` remains active and recoverability is preserved.
