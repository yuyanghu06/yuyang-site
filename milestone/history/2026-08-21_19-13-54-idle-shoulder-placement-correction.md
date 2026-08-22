# Idle shoulder-placement correction

User review found that the initial 12% clavicle-span extension left the shoulders too narrow and the arm mass too far behind the torso.

Revised `public/animations/idle-shoulders-extended-review.glb` to use a 30% clavicle-span increase, move each complete arm/hand/finger subtree with its upper-arm joint, and key both shoulder chains 4.5 cm forward plus 1.2 cm outward throughout the idle. Front and right-side live Blender review now show a wider shoulder line and hanging arms alongside the torso instead of behind it.

The protected `idle.glb` remains unchanged. Blender 5.1 validation retains 52 bones, three meshes, one `Idle_Loop` over frames 0–60, and full first/last pose-matrix closure within `1.05e-7`. The revised candidate remains unapproved pending user review.
