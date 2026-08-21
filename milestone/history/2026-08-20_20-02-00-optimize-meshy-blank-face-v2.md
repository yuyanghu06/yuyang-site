# Optimize approved Meshy blank-face v2

- The user approved the Meshy 7 Ultra v2 shape and requested optimization.
- Imported the untouched 118 MiB source into a clean Blender scene. It contained one mesh with 1,599,961 vertices, 3,115,106 faces, one UV map, one material, and a packed 4096×4096 base-color image.
- Applied collapse decimation to 39,999 faces and resized the base color to 2048×2048. Smooth shading preserves the approved blank face and hair silhouette without geometry cracks.
- Saved the authoring file as `assets/blender/yuyang-avatar-meshy-blank-face-v2-optimized.blend` and the web asset as `public/models/yuyang-avatar-meshy-blank-face-v2-optimized.glb`.
- The optimized GLB is 6,409,008 bytes, 94.8% smaller than the 124,209,920-byte Ultra source.
- Verified a clean GLB import round-trip: 39,999 faces, 34,219 imported vertices, one UV layer, and one material.
- Saved full-body and close-up review renders in `public/style-references/avatar/`; both confirm a smooth continuous face with the approved silhouette intact.
