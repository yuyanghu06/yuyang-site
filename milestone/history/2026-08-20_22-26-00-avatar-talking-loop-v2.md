# Avatar talking loop V2

- Retargeted the Universal Animation Library Standard `Idle_Talking_Loop` onto the authoritative 54-bone V2 avatar rig as `Yuyang_Talking_Loop_v2`.
- Added `assets/blender/yuyang-avatar-talking-loop-v2.blend`, `public/models/yuyang-avatar-talking-loop-v2.glb`, and the 540x720 30 fps review `public/style-references/avatar/yuyang-avatar-talking-loop-v2.mp4`.
- The displayed loop is 88 frames / 2.933 seconds and omits the duplicate terminal pose. Automated validation confirms non-static motion and exact first/terminal closure (`0.0`).
- Nine evenly spaced review samples keep the arms at the sides and the new finger chains neutral, with no visible clawing, hand splitting, or thigh/body penetration.
- A clean GLB import retains 54 bones, including 30 hand bones, and exactly one action named `Yuyang_Talking_Loop_v2`.
- Generalized the shared retarget export helper so a single-clip wrapper does not require the source action to be named `Idle_Loop`.
