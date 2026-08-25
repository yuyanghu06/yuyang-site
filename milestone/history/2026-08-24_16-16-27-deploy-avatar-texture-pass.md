# Deploy avatar texture-paint pass

The user's live Blender Texture Paint changes were exported into the site's `public/animations/idle.glb` as the revised embedded `Mesh_0_BaseColor` texture. The existing site GLB was backed up to `/tmp/idle-before-texture-pass-2026-08-24.glb` before export.

Targeted GLB inspection confirmed parity with the previous runtime asset: 55 nodes, two meshes, one 52-joint skin, three embedded textures, and one `Idle_Loop` with 156 channels. The base-color JPEG changed from 1,086,360 to 1,085,455 bytes while the normal and face textures retained their previous byte sizes. The runtime URL cache key was advanced to `20260824-user-texture-paint-pass`.
