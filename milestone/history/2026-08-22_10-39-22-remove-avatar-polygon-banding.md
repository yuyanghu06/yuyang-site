# Remove avatar polygon banding

Visual review showed that four-step toon lighting emphasized the source avatar's faceted normals across the face and neck. The browser renderer now converts body, hair, and clothing materials to unlit MeshBasic materials instead. Their base colors, textures, transparency, depth settings, and draw sides are preserved, while normal-dependent light bands and glossy response are removed.

The GLB geometry, UVs, skeleton, animation, and dedicated animated face-canvas material remain unchanged.
