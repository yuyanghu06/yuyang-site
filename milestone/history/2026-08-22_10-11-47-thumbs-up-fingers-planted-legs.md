# Thumbs-up finger correction and planted legs

- User review rejected the first thumbs-up hand because its finger rotations produced an open hand and hyperextended thumb.
- Added a Blender correction pass that maps the evaluated palm and all three joints of each raised-hand digit from the Quaternius `Yes` source by bone direction, while retaining exact neutral hand/finger bookends.
- Froze hips and the complete left/right thigh, shin, foot, and toe chains to the approved idle opening pose for every gesture sample.
- Regenerated `public/animations/thumbs-up-review.glb`. It now contains exactly one force-sampled `Thumbs_Up` Action, zero numerical lower-body motion, and exact `0.0` first/last closure. It remains unapproved and unwired pending visual review.
