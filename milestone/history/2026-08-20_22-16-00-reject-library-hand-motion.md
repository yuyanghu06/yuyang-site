# Reject library hand motion

- Final visual review rejected the corrected Quaternius hand-motion branch because the talking trajectory still carries the rigid original hand into the thigh/body.
- Independent finger mapping, rigid-finger whole-hand mapping, and corrected arms-at-sides delta composition were all tested; none produced an acceptable result on this fused stylized hand geometry.
- Deleted `scripts/retarget-quaternius-idles-with-hands.py` and removed all hand-motion test outputs from production paths.
- Isolated the recoverable rejected Blender file, GLB, and MP4s under ignored `data/work/rejected-hand-motion-test-2026-08-20/`.
- Authoritative library candidates are again the collision-safe `yuyang-avatar-library-idles` assets with shoulder-to-hand chains locked at the arms-at-sides pose.
- The dormant 34-bone `yuyang-avatar-hand-rig-v1` remains structural only and must not receive automatic Quaternius hand/finger retargeting.
