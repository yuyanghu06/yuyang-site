# Lock idle arm chains to prevent hand clipping

- User review found that rigid hands still clipped into the thighs because imported forearm and upper-arm motion continued carrying them through the body.
- Removed source shoulder and forearm mappings from both Quaternius idles and made both upper-arm Actions constant at the mirrored 22° arms-at-sides base pose.
- The complete shoulder-to-hand chains are now visually static relative to the animated torso; hips, legs, torso, neck, and head retain the retargeted motion.
- Regenerated the combined Blender file, two-Action GLB, and both MP4 comparisons in place.
- Reviewed eight evenly distributed talking-idle frames; both hands remain outside the thighs with no twist, split, or clipping.
- Both Actions still pass non-static body-motion validation and exact `0.0` loop-boundary verification.
