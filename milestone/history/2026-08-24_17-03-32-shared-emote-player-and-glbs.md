# Shared emote player and exported GLBs

Added a shared persistent-scene avatar emote player. Startup now invokes `wave_hello` through the same registry and `play(emote)` path used by validated `trigger_avatar_emote` browser commands. Emote GLB scenes are disposed after animation extraction, so the continuously mounted `idle.glb` remains the sole owner of the body, skeleton, and Head-skinned face mesh.

Exported `nod-smile.glb` and `head-shake-disappointed.glb` into `public/animations/`. Each is two seconds, retains 55 nodes, two meshes, one 52-joint skin, three textures, and 156 channels, and returns to a numerically exact neutral bookend. Added both emotes to the tool allowlist and coordinated their runtime face states. Removed the unused unapproved `wave-hello-review-v1.glb`; retained `idle.glb` and active wave v2. ESLint, TypeScript, diff checks, both HTTP routes, and direct GLB validation pass.
