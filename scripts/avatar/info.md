# Avatar scripts

Avatar authoring, rigging, conversion, and retargeting scripts live here. Earlier pipeline inputs referenced by reconstruction scripts are archived under ignored `data/raw/avatar-blender-archive-2026-08-20/`.

The permanent source/library/checkpoint contract and mandatory retargeting review gates are documented in `docs/avatar-animation-system.md`. New scripts must preserve that mapping contract and create a new review output rather than overwrite the accepted checkpoint.

## Files

- `add-talking-face-to-loop-v2.py` combines the approved face canvas with the V2 talking source.
- `audit-glb-stretched-vertices.py` samples an animated GLB and reports the mesh edges with the largest deformation-to-bind length ratios together with their vertex-group weights, for diagnosing finger-driven spikes.
- `create-vrm1-from-tripo-rig.mjs` reproducibly adds a complete 52-bone VRM 1.0 humanoid declaration and standardized bone names to the direct Tripo rig without changing mesh, weights, textures, or bind matrices. Setting `YUYANG_VRM_ORIGINAL_ARM_SIDES=1` recreates the earlier swapped-arm checkpoint.
- `embed-vrm-idle-absolute-recovery.mts` reconstructs the earlier absolute-retarget idle; `--swap-arm-motion` corrects reversed rig-side labels while converting opposite source motion through each physical target arm's rest basis, and `--mirror-arms` remains a rejected double-reflection diagnostic.
- `embed-vrm-idle.mts` loads the standardized VRM rig and an external Quaternius library, conjugates a selected source clip's motion deltas through the source/target rest-axis difference while preserving the fitted target pose, and writes a standalone GLB containing the baked Action. Optional CLI arguments select the source and output clip names; non-idle one-shots use the approved embedded idle's opening pose as their neutral bookend and hold the hips plus complete leg/foot/toe chains fixed.
- `export-runtime-emote-glbs.mjs` derives the reviewed nod and disappointed head-shake clips from the accepted idle checkpoint, retains only their animated head/neck tracks, and strips duplicate scene resources. It also reduces the approved wave to its moving arm rotations. Runtime reconstructs locked channels from the persistent idle clip.
- `extract-glb-animation.mjs` preserves an input GLB's exact scene, mesh, skin, materials, and buffers while reducing its animation table to one requested named clip.
- `fix-cross-hand-skin-weights.mjs` removes opposite-side shoulder, arm, hand, and finger influences from spatially separated hand vertices and renormalizes the remaining weights, repairing cross-hand mesh spikes without changing animation tracks or geometry.
- `create-yuyang-avatar-idle-loop-v2.py` authors the retained V2 idle loop.
- `create-yuyang-avatar-idle.py` reconstructs the earlier idle avatar source.
- `create-yuyang-avatar-talking-loop-v2.py` authors the retained V2 talking loop.
- `generate-parameterized-voxel-avatar.py` builds a deterministic voxel/low-poly hybrid avatar from an editable JSON preset, merges all visible pieces into one rigidly weighted mesh, renders a review image, and exports a rigged GLB without touching the authoritative avatar.
- `retarget-quaternius-idles.py` retargets Quaternius idle motions in Blender.
- `retarget-avatar-gesture-digits.py` corrects the single raised `LeftArm`/`LeftHand` rig chain by matching evaluated Quaternius palm and digit directions while preserving exact neutral bookends. It keeps that upper arm in the approved relaxed direction and bends only the forearm upward, preventing the arms-down shirt weights from stretching into a curved sleeve band.
- `retarget-vrm-arms-by-direction.mts` drives idle shoulders, upper arms, and forearms from source joint directions, avoiding incompatible left/right names and bone-roll quaternions. For non-idle gestures it transfers the complete shoulder-to-hand and finger hierarchy through world-space motion deltas while preserving the input body and leg tracks; optional CLI arguments select source and target Action names.
- `render-glb-skeleton-xray.py` renders a posed GLB armature as blue bones and orange joints through a translucent mesh, with optional hand-only framing for deformation audits.
- `mirror-recovered-vrm-arms.mts` supports target-space arm-mirror diagnostics and can splice a separately calibrated replacement clip onto only the shoulder, arm, hand, and finger tracks while preserving all recovered body tracks.
- `rig-yuyang-original-hands.py` reconstructs the earlier original-hand rig pass.
- `swap-vrm-arm-animation-channels.mjs` creates the rejected diagnostic channel-level arm swap used to prove that mirrored left/right local axes require quaternion conversion rather than target exchange.
- `yuyang-voxel-avatar-v1.json` records the review V1 proportions, portrait-derived palette, hairstyle, facial features, clothing, and source-photo provenance used by the parameterized voxel generator.
- `yuyang-voxel-avatar-v2.json` records the revised illustrated-face target, including the user's separate portrait and approved non-voxel style reference, darker palette, rounded face, larger brown eyes, and watch-free clothing specification used by reviews V2–V4.
- `info.md` documents this folder.

There are no direct subfolders.
