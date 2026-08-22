# Embedded face, fixed legs, and full-screen framing

The live `public/animations/idle.glb` now embeds the neutral illustrated face as a second mesh skinned 100% to the existing `Head` joint. This replaces the browser-created face canvas, eliminating its independent runtime transform. The neutral 512×512 texture is embedded in the GLB, and the obsolete `face-canvas.ts` plus runtime atlas-loading path were removed.

The idle Action freezes `Hips` and both complete upper-leg, leg, foot, and toe chains at their corrected frame-zero transforms. Five sampled frames show exact `0.0` matrix drift for every frozen joint. Removing the hips' former constant `-13.324°` local turn makes the avatar face the camera directly while preserving head, neck, shoulder, arm, hand, and finger motion.

Direct GLB inspection reports two skinned meshes, one 52-joint skin, embedded face/base-color/normal textures, a 2.5-second `Idle_Loop` with 156 channels, and exact `0.0` first/last closure. The previous live binary remains recoverable for this session at `/tmp/yuyang-idle-before-embedded-face-2026-08-21_20-30.glb`.

Full-screen framing now enlarges the avatar to 150% of the prior scale and lowers its camera composition by 20% of avatar height. The horizontal camera offset is divided by the same scale factor so the accepted left/right placement does not drift right merely because of the zoom. Targeted ESLint, TypeScript, GLB structure, frozen-chain, loop, and whitespace checks pass.
