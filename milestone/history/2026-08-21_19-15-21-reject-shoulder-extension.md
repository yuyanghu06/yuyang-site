# Rejected shoulder-extension experiment

User review exposed catastrophic sleeve/chest tearing and unstable hand deformation in the forward/outward shoulder-translation candidate.

Deleted `public/animations/idle-shoulders-extended-review.glb`, removed its isolated Blender objects and orphaned review Actions, and reimported the untouched `public/animations/idle.glb` into the live front material-preview viewport. The accepted idle's SHA-256 still matches its pre-experiment backup: `d78abbf1e221741737df06b596c8bec02a04310b547d80b3ab1f15cf42e74a39`.

The failure confirms that weighted shoulder pose-bone translation is not a valid shortcut. A later correction must rebuild joint placement, rest matrices, mesh deformation, and shoulder/torso weights coherently from the original asset.
