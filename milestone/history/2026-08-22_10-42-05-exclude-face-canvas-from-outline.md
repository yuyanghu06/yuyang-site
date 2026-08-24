# Exclude face canvas from outline

The first screen-space outline selected the avatar root, which recursively included the transparent rectangular `Yuyang_EmbeddedFace` canvas. Outline selection now contains only descendant meshes other than that face canvas, so the black border follows actual head, hair, neck, torso, and limb geometry instead of the facial plane.
