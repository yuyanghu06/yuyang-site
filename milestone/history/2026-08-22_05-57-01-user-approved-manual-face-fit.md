# User-approved manual face fit

- Re-enabled XYZ location and rotation controls so the user could position the embedded face directly in the live Blender viewport.
- The user explicitly approved the resulting face placement.
- Preserved the exact approved transform: location `(-0.000442441, -0.065205455, 0.336710483)`, XYZ Euler rotation `(0.280676663, -0.085589372, 0.202968687)`, and scale `(1.164230943, 1.164231062, 1.164230943)`.
- Re-locked location, rotation, and scale and verified all 442 face vertices remain weighted exactly and exclusively to `Head`.
- Saved the authoritative Blender source, exported the live `public/animations/idle.glb`, and advanced the runtime cache key.
- The five-second `Idle_Loop` retains exact `0.0` full pose-matrix loop closure.
