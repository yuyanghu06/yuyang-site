# Thumbs-up review GLB

- Added the reusable CC0 Quaternius UAL2 Standard library under `public/models/`; its `Yes` action is the correct thumbs-up source. UAL1's ambiguous `Interact` action was visually checked and rejected because it is an open-hand reach.
- Extended the existing avatar bake/retarget scripts to accept named source/output Actions, use the approved idle opening pose as a neutral bookend, support the live non-VRM GLB's named joints, and transfer complete gesture arm/finger motion in world space.
- Created `public/animations/thumbs-up-review.glb` with the approved runtime avatar body and embedded Head-skinned face. Validation reports one 2.5-second `Thumbs_Up` Action, 53 channels, finite samples, one skin, two meshes, and exact `0.0` first/last closure.
- The review remains unapproved and is not wired to `trigger_avatar_emote({ emote: "thumbs_up" })` pending user inspection.
