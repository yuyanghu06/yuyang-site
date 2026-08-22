# Avatar face chin fit

- Opened the authoritative `assets/blender/yuyang-avatar-talking-loop-face-v2.blend` in the connected Blender session.
- Rejected rigid upward and outward canvas translations after front and side review showed missing facial artwork and a visibly floating face sheet.
- Restored the manually fitted object transform and original close skin clearance.
- Raised only the lower jaw/chin vertices with a smooth falloff and a maximum 10 mm correction, preserving topology and the seated curved fit.
- Locked location, rotation, and scale on `Yuyang_EmbeddedFace` and verified all 442 vertices remain weighted exactly and exclusively to `Head`.
- Saved the authoritative Blender source. No GLB was exported in this pass, so `public/animations/idle.glb` remains unchanged.
