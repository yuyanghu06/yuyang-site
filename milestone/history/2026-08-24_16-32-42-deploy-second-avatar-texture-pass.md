# Deploy second avatar texture-paint pass

The user's second live Blender Texture Paint revision was extracted from the accepted 52-joint mapping source and installed into the site's `public/animations/idle.glb` as a texture-only replacement of `Mesh_0_BaseColor`.

The previous runtime GLB was backed up to `/tmp/idle-before-texture-pass-2026-08-24-second.glb`. Structural comparison confirms both versions retain 55 nodes, two meshes, one 52-joint skin, three embedded textures, and the 156-channel `Idle_Loop`; only the base-color JPEG changed from 1,085,455 to 1,403,079 bytes. The runtime cache key advanced to `20260824-user-texture-paint-pass-2`.
