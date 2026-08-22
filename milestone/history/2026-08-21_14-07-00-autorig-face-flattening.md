# Auto-rig face flattening

- Installed the external `blender-modeling-modifiers` skill for discovery on the next turn after the curated/experimental OpenAI skill catalogs contained no dedicated mesh-deformation skill.
- Kept the Meshy-generated auto-rig surface, UVs, 24 vertex groups, and 24-bone hierarchy intact while moving 1,013 vertices in a localized elliptical facial patch by at most `0.064821` meters to remove the generated nose projection.
- Saved the separate candidate as `data/work/avatar-meshy-skeleton-template-review/yuyang-avatar-meshy-auto-rig-face-flattened-review.blend` and exported the matching GLB without changing the authoritative avatar source or site assets.
- Blender GLB round-trip validation retains 24 bones, all 24 deform groups, 31,559 imported vertices, 30,951 polygons, and one animation. Front and side renders were inspected before opening the candidate in Blender.
- The remaining faint nose-like mark in the front render is baked into the base-color texture rather than protruding geometry; this pass intentionally changes geometry only.
