# Avatar screen-space outline

The browser avatar renderer now uses an EffectComposer with RenderPass, OutlinePass, and OutputPass. The complete animated avatar is selected for a restrained black screen-space silhouette with edge strength `2.8`, thickness `1.15`, zero glow, and no pulse.

The effect follows the existing skinned animation automatically and does not alter the GLB mesh, normals, UVs, rig, or clips. Post-processing resources are disposed with the renderer.
