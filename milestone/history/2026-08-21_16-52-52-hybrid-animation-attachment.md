# Hybrid animation attachment

The authoritative `Yuyang_Idle_Loop_v2` and `Yuyang_Talking_Loop_v2` Actions were attached to the hybrid Meshy-body/Tripo-finger 54-bone review rig. Meshy's generated placeholder clip was removed.

The idle retains its exact frame 1–76 range and closes within `7.45e-09` maximum bone-matrix delta. Talking retains frames 1–89 and closes at `0.0`. Both remain finite across five sampled frames. A persistence audit caught Blender dropping the inactive idle Action on reopen; both Actions now have explicit retained users, and the combined GLB round-trips with both names and all 54 bones.

The editable source is `assets/blender/yuyang-avatar-hybrid-meshy-body-tripo-hands-animated-review.blend`, the combined inspection GLB is under `public/models/`, and the idle/talking start-mid-side-end contact sheet is under `public/style-references/avatar/`. This remains a review candidate and is not deployed.
