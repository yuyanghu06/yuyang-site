# Avatar review artifacts

This directory contains avatar concepts, atlases, renders, and animation reviews. The approved facial direction is a cohesive 2D atlas bound through the head's actual UV/material path.

Do not use the checkerboard draft, a detached DOM face, a separate face panel, or rejected sculpted facial animation as production input.

## Parameterized voxel review

- `yuyang-voxel-avatar-review-v1.png` is the first rendered review of the portrait-derived voxel/low-poly hybrid generator. It is an unapproved candidate with tall proportions, dark center-part hair, forest crewneck, white undershirt, charcoal jeans, dark shoes, and a left-wrist watch.
- `yuyang-voxel-avatar-review-v2.png` is the rejected coarse rounded-face revision.
- `yuyang-voxel-avatar-review-v3.png` is the rejected volumetric-head diagnostic whose facial features were hidden behind the curved shell.
- `yuyang-voxel-avatar-review-v4.png` is the current unapproved review with corrected facial depth, wider shoulders, aligned arms, no watch, and revised hands.

## Approved 2026 flat-face Meshy references

- `quaternius-idle-loop-base-skeleton-xray.png` shows the untouched base mannequin skeleton at the midpoint of its original `Idle_Loop`; use it as the authoritative source-pose reference for shoulder, elbow, wrist, and hand placement before any further retargeting.
- `yuyang-avatar-flat-face-meshy-v1-front.png` is the approved straight-on primary image for the new Meshy 7 multiview generation.
- `yuyang-avatar-flat-face-meshy-v1-left.png` is the approved exact left-profile image; its facial silhouette intentionally has no nose or lips.
- `yuyang-avatar-flat-face-meshy-v1-back.png` is the approved rear reference for hair, clothing, pants, and shoes.
- `yuyang-avatar-flat-face-meshy-v1-three-quarter.png` is the approved right three-quarter consistency reference.
- `yuyang-avatar-flat-face-meshy-v1-turnaround.png` is the approved four-view review sheet from which the individual generation references were developed. Submit the four individual files to Meshy rather than this composite.
- `yuyang-avatar-flat-face-tripo-quad-50k-preview.webp` is Tripo's baked preview for Smart Low-Poly task `c9929452-f87b-4b89-97c6-e99568f1d230`; use it only for an initial appearance check alongside the inspectable GLB.
- `yuyang-avatar-tripo-quad-50k-rig-contact-sheet.png` compares front, left, back, and right views at talking frames 1 and 45 after binding the definitive 54-bone V2 skeleton.
- `yuyang-avatar-tripo-v2-skeleton-front-overlay.png` is an x-ray front view of the definitive V2 rest skeleton laid inside the approved Tripo mesh. It exposes the current bind mismatch: the body joints broadly align, but the digit chains sit outside the modeled hands and require rest-bone refitting.
- `yuyang-avatar-tripo-quad-50k-meshy-rig-xray.png` shows front and side x-rays of Meshy AI Rigging task `01a02667-642a-7720-8a81-c96699b37a2d` inside the approved Tripo surface. The 24 body bones align anatomically, but Meshy supplies no finger chains.
- `yuyang-avatar-tripo-quad-50k-tripo-rig-xray.png` shows Tripo's complete 52-bone AI rig inside the approved surface from the front and side.
- `yuyang-avatar-tripo-quad-50k-tripo-rig-hands-xray.png` isolates Tripo's fitted digit chains for hand-level inspection.
- `yuyang-avatar-hybrid-meshy-body-tripo-hands-full-xray.png` shows the complete hybrid 54-bone rest skeleton inside the mesh.
- `yuyang-avatar-hybrid-meshy-body-tripo-hands-closeup-xray.png` provides dedicated left/right hand x-rays of the hybrid rig.
- `yuyang-avatar-hybrid-animated-idle-talking-contact-sheet.png` compares idle start/mid/side/end on the top row with talking start/mid/side/end on the bottom row after attaching both authoritative Actions to the hybrid rig.
- `yuyang-avatar-vrm1-idle-channel-swapped-skeleton-xray.png` is the full-body frame-45 x-ray of the rejected channel-level arm swap. It visibly shows crossed shoulder/clavicle chains and confirms that a simple left/right channel exchange is structurally invalid.
- `yuyang-avatar-vrm1-idle-mirrored-arm-skeleton-xray.png` and `yuyang-avatar-vrm1-idle-mirrored-arm-hands-xray.png` document the rejected double-reflection test, whose arm chains fold behind the torso.
- `yuyang-avatar-vrm1-idle-physical-arm-mapped-skeleton-xray.png` is the midpoint audit of the isolated opposite-source/no-reflection mapping candidate; it remains a debugging artifact pending user inspection.
- `yuyang-avatar-vrm1-idle-reflected-motion-skeleton-xray.png`, `yuyang-avatar-vrm1-idle-target-space-arm-mirror-skeleton-xray.png`, and `yuyang-avatar-vrm1-idle-target-space-pose-mirror-skeleton-xray.png` document rejected reflection variants whose arm chains remain T-posed or crossed.
- `yuyang-avatar-vrm1-idle-arm-hand-adapter-skeleton-xray.png` is the midpoint full-body audit of the isolated limb adapter candidate; it shows non-crossing shoulder, arm, and hand chains inside the mesh while the accepted body animation remains unchanged.
- `yuyang-avatar-vrm1-idle-arm-hand-adapter-hands-xray.png`, `yuyang-avatar-vrm1-idle-arm-hand-adapter-left-hand-xray.png`, and `yuyang-avatar-vrm1-idle-arm-hand-adapter-right-hand-xray.png` are hand-framing diagnostics for the same candidate. The full-body x-ray is the clearer structural reference because the close cameras remain partially occluded by the low-poly hand surface.
- `yuyang-avatar-vrm1-idle-direction-arms-weight-fixed-skeleton-xray.png` is the midpoint audit of the weight-repaired, joint-direction arm candidate. Both shoulder-to-hand chains stay on their physical sides and remain inside the mesh without crossing.
- `yuyang-avatar-vrm1-idle-direction-arms-original-hands-torso-corrected-xray.png` is the midpoint audit of the current candidate with original hand/finger tracks and shoulders solved against the animated torso. It shows symmetric uncrossed arms and hands beside the hips.

## Photoshop texture-cleanup handoff

- `yuyang-avatar-basecolor-cleaned-v3-raw.png` is the untouched 2048×2048 base-color texture extracted from the current site idle GLB for manual Photoshop repair.
- `yuyang-avatar-basecolor-cleaned-v3-annotated.png` is an ImageGen-produced visual reference with small red circles around likely blemishes in peach skin islands. It is not resolution- or pixel-faithful production input; use it only to locate candidate repairs on the raw texture.

## Meshy T2 facial atlas regeneration

- `yuyang-avatar-face-talking-atlas-meshy-t2-v1-source.png` is the original 1254×1254 transparent ImageGen output from the rejected attempt to redesign the face around the nosed T2 mesh. It is retained only as generation provenance and is not sampled at runtime.
- `yuyang-avatar-face-talking-atlas-meshy-t2-v1.png` is the normalized 2048×1024 derivative of that rejected candidate. It is retained for comparison only; the live avatar again uses the old approved `yuyang-avatar-face-talking-atlas.png`.

## Live approved face states

- `yuyang-avatar-neutral-face-approved.png` is the exact 512×512 transparent neutral artwork extracted from the user's approved manually positioned embedded face.
- `yuyang-avatar-neutral-face-blink-closed.png` preserves that approved neutral identity while replacing only both open eyes with symmetric dark-brown closed-eyelid curves. The runtime uses it for two brief blinks per five-second loop, including while speech mouth states advance independently.
- `yuyang-avatar-face-talking-atlas.png` remains the approved 2048×1024 transparent four-by-two source atlas.
- `yuyang-avatar-talking-mouth-0.png`, `yuyang-avatar-talking-mouth-1.png`, `yuyang-avatar-talking-mouth-2.png`, and `yuyang-avatar-talking-mouth-3.png` are transparent mouth-only derivatives from the atlas's bottom row. The runtime composites these over the independently selected open- or closed-eye face, so talking never controls blinking.

## Voxel face review

- `yuyang-avatar-face-voxel-talking-atlas-v1.svg` is the editable eight-state voxel-style face candidate. Its neutral, half-blink, closed-blink, four speech openings, and smiling speech state preserve the approved atlas layout while replacing curves with crisp, flat blocks on an eight-pixel grid.
- `yuyang-avatar-face-voxel-talking-atlas-v1.png` is the rasterized 2048×1024 review/runtime candidate generated from the SVG. It is not approved or connected to the authoritative Blender avatar.
- `yuyang-avatar-face-voxel-talking-contact-sheet-v1.png` is the labeled review sheet for evaluating all eight states before the candidate is bound to the curved face canvas.
