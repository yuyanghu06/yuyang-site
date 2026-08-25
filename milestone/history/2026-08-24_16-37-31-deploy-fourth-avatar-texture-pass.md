# Deploy fourth avatar texture-paint pass

The user's latest live Blender Texture Paint revision was installed into the site's `public/animations/idle.glb` as a texture-only replacement of `Mesh_0_BaseColor`.

The preceding runtime GLB was backed up to `/tmp/idle-before-texture-pass-2026-08-24-fourth.glb`. Validation confirms 55 nodes, two meshes, one 52-joint skin, three embedded textures, and the 156-channel `Idle_Loop`; only the base-color JPEG changed from 1,404,635 to 1,403,951 bytes. The runtime cache key advanced to `20260824-user-texture-paint-pass-4`.
