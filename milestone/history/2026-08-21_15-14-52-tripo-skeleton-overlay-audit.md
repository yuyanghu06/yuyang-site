# Tripo skeleton overlay audit

After reviewing the rigged candidate, the user observed that its arms did not resemble the authored idle animation and requested the definitive template skeleton laid inside the mesh.

`public/style-references/avatar/yuyang-avatar-tripo-v2-skeleton-front-overlay.png` renders the actual V2 rest joints and hierarchy through the translucent Tripo surface. Oversized imported FBX display tails were excluded so the image connects true parent/child joint positions instead of misleading bone-display lengths.

The overlay shows broad body alignment through the hips, legs, torso, shoulders, elbows, and wrists, but both complete digit chains are laterally displaced outside the modeled hands. The current rig-transfer candidate is therefore not a correct final bind despite passing structural and numerical checks. Hand/finger rest bones and their weights require a controlled refit before the asset can be approved or deployed.
