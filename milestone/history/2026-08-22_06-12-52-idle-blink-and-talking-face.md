# Idle blink and talking face

- Restored the approved face depth after rejecting the temporary 1 mm eye-clearance test.
- Extracted the exact approved neutral face as a transparent 512×512 reference and created a matching closed-eye state that changes only both eye regions.
- Added two 120 ms closed-eye blinks to every five-second idle cycle.
- Reused the current approved `Idle_Loop` body animation during speech and switched only the existing Head-skinned face material through the four bottom-row talking-mouth atlas states at 130 ms cadence.
- Wired agent streaming state into the persistent avatar without remounting Three.js or loading a second body GLB; neutral returns immediately when speech stops.
- Targeted ESLint and full TypeScript checks pass.
