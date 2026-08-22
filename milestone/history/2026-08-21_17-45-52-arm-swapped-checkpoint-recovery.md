# Arm-swapped checkpoint recovery

- Reconstructed the specific absolute-retarget checkpoint the user identified as acceptable except for swapped arms.
- Added an opt-in original-arm-side mode to the VRM metadata generator without changing its current default mapping.
- Added a dedicated absolute-retarget recovery baker matching the earlier sampling path.
- Produced the rig-only and animated recovery GLBs; the latter contains one three-second `Idle_Loop` with 53 channels.
- Targeted ESLint and full TypeScript checking pass.
