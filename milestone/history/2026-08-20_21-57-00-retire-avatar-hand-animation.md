# Retire avatar hand animation

- User rejected the talking-idle hand deformation and chose to stop pursuing articulated-hand or thumbs-up animation for this avatar.
- The source library's wrist/hand rotation visibly twisted and split the mitten-like right-hand silhouette.
- Removed `hand_l` and `hand_r` from the Quaternius retarget map and removed hand animation from the custom idle authoring script.
- Regenerated the combined two-Action Blender/GLB avatar and both comparison MP4s in place.
- Contact-sheet review confirms both hands now remain rigid in the neutral wrist pose while forearms, arms, torso, hips, neck, and head continue animating.
- Future hand work is limited to remodeling a cleaner fixed neutral mesh silhouette; it will not add finger bones, thumb controls, hand gestures, or hand animation channels.
