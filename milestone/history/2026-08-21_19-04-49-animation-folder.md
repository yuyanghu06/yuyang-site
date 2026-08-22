# Public animation folder

Created `public/animations/` as the permanent home for standalone exported animation GLBs and documented the policy in the repository instructions and avatar animation system.

Moved the protected torso-corrected mapping checkpoint from its long review filename under `public/models/` to `public/animations/idle.glb` without modifying its contents.

Updated the live idle loader to use `/animations/idle.glb`; the file validates as glTF 2.0 and contains the expected `Idle_Loop` Action.
