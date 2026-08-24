# Parameterized voxel avatar review V1

- Added an editable JSON-driven Blender generator for deterministic voxel/low-poly hybrid avatars.
- Encoded the user's supplied portrait as a review preset: warm medium skin, dark tousled center-part hair, dark forest crewneck, white undershirt, charcoal jeans, dark shoes, and a left-wrist watch.
- Generated `assets/blender/yuyang-voxel-avatar-review-v1.blend`, `public/models/yuyang-voxel-avatar-review-v1.glb`, and the studio render `public/style-references/avatar/yuyang-voxel-avatar-review-v1.png`.
- Kept all visible pieces in one merged mesh with rigid vertex weights across an 18-bone humanoid armature.
- Round-trip import found the exported avatar armature and merged mesh with 18 vertex groups. The candidate remains unapproved and is not connected to the website runtime.
- The authoritative 54-bone avatar sources and accepted `public/animations/idle.glb` were not overwritten.
