# Idle shoulder-joints-only review

Created `public/animations/idle-shoulder-joints-review.glb` from the untouched accepted idle after clarifying that only the shoulder joints should move.

Moved each clavicle-to-upper-arm joint 1.8 cm outward and 2.5 cm forward and translated the complete downstream arm/hand/finger rest-bone subtree with it. Did not move shoulder roots, edit animation keys, alter mesh coordinates, or change skin weights.

The live Blender viewport shows the result with a front X-ray skeleton overlay. Blender 5.1 round-trip validation retains 52 bones, three meshes, one `Idle_Loop` over frames 0–60, and exact `0.0` loop-matrix closure. The candidate remains unapproved; `idle.glb` is untouched.
