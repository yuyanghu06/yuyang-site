# Guided-Tour Avatar Animation System

## Fresh-session source of truth

- The only authoritative editable avatar source is `assets/blender/yuyang-avatar-talking-loop-face-v2.blend`. It has the definitive 54-bone V2 hierarchy: the fitted 24-bone Meshy body plus three connected deform joints for every digit on both hands.
- The reusable external motion source is `public/models/quaternius-vrm-animation-library.glb`, a byte-identical copy of `src/assets/AnimationLibrary.glb` from the separately cloned `norio/vrm-game-starter` repository at commit `b14c236fd8150855348ad085b7820c298eac4b30`. The starter retargeting code is MIT-licensed; the Quaternius animation asset keeps its separate license.
- `public/models/quaternius-idle-loop-reference.glb` is the untouched source mannequin reduced to the original three-second `Idle_Loop`. Use this—not a re-export or screenshot—as the definitive source pose and motion reference.
- The accepted current mapping checkpoint is `public/animations/idle.glb`, and the live avatar loader plays its embedded `Idle_Loop`. Preserve it byte-for-byte before making another candidate. All future standalone exported animation GLBs must also live under `public/animations/`, not `public/models/`.
- The matching midpoint audits are `public/style-references/avatar/quaternius-idle-loop-base-skeleton-xray.png` and `public/style-references/avatar/yuyang-avatar-vrm1-idle-direction-arms-original-hands-torso-corrected-xray.png`.

## Skeleton matching and retargeting contract

These are permanent mapping rules, not fixes tailored to one idle clip:

1. Identify left and right from the skeleton's physical bind-space position and hierarchy, then record the semantic VRM assignment once. Do not infer side from a misleading source name and do not repair sides by exchanging animation channel targets.
2. Preserve the target mesh, skin, inverse bind matrices, bone lengths, joint locations, hierarchy, and fitted rest transforms. Source and target bones may represent the same joint while having very different displayed lengths; retarget rotation and joint direction, never source bone length or source joint translation.
3. Preserve all currently accepted body, hips, leg, neck, head, hand, and finger tracks unless the review explicitly identifies one of those chains. Changes must be isolated to the named chain.
4. For shoulders, upper arms, and forearms, solve the source parent-to-child joint direction in world space against the target chain at each sampled frame. Convert the result back to target-local rotation through the target parent's animated world transform. In particular, shoulders must be solved relative to the animated torso, not the rest torso.
5. Keep the recovered original target hand rotations and all 30 finger tracks for the current idle baseline. Do not direction-retarget, reflect, globally invert, or side-swap hands/fingers unless a later gesture is being authored and reviewed independently.
6. Preserve the localized cross-hand weight repair: vertices spatially belonging to one hand may not carry opposite-side shoulder, arm, hand, or finger influence. Renormalize after removing invalid influences.
7. Treat bone roll and local quaternion axes as rig-specific. A visually mirrored hierarchy can still have different local bases; raw quaternion copying, metadata-only side swaps, channel swaps, or sagittal reflection are invalid substitutes for basis conversion.
8. Retarget source motion deltas relative to a known source reference pose when bind poses differ. Never impose the Quaternius mannequin's absolute T/A-pose on the fitted arms-down avatar.
9. Animation-specific tuning is limited to small, documented rotation offsets or motion scaling after the structural mapping passes. Never change hierarchy, side assignment, rest pose, bone length, or weights merely to make one frame of one clip look correct.
10. Every new library clip must go through the same mapping adapter. Do not hand-author a second mapping for each animation.

## Required review and validation

Before presenting or deploying any new retargeted GLB:

- Duplicate the accepted checkpoint to a new review filename; never overwrite the checkpoint during iteration.
- Inspect the GLB directly. Browser verification is optional unless the website renderer itself changed.
- Confirm the expected animation name, duration, channel targets, finite samples, nonzero motion, and exact first/last loop closure.
- Confirm the VRM humanoid mapping, hierarchy, skin, inverse bind matrices, mesh/materials, and bone count are preserved.
- Render the source skeleton and target skeleton at the same normalized animation time. Also render an X-ray with bones visibly inside the target mesh.
- Inspect front, back, both sides, both hands, shoulders/clavicles, elbows, wrists, hips, knees, ankles, and the top of the head. Skeleton endpoints should remain inside the mesh except for deliberate helper/non-deform tips.
- Run the stretched-edge/weight audit across multiple frames. Reject cross-body spikes, opposite-side hand influence, finger inversion, shoulder crossing, foot sliding, or mesh collapse.
- Compare the animated mesh to the approved avatar surface and the untouched source animation reference. A structurally valid skeleton is insufficient if deformation or silhouette no longer matches either reference.
- Record separately which changes improve the reusable mapping and which are clip-specific tuning. Default to preserving the mapping after approval and making only small adjustments.

## Known rejected approaches

- Metadata-only left/right swaps.
- Swapping complete arm or finger animation channel targets without converting between local bases.
- Raw local-quaternion copying between the Quaternius and fitted rigs.
- Global or sagittal arm reflection.
- Applying the source mannequin's absolute T/A-pose to the target bind.
- Direction-retargeting the current idle's hands/fingers after their original tracks were restored.
- Solving shoulders against the target rest torso instead of its animated transform.
- Judging skeleton fit from a surface render alone without an X-ray.

## Product role

The small Yuyang avatar is a persistent guided-tour presenter. It accompanies streamed building descriptions and follow-up answers so the experience feels like Yuyang is personally guiding the visitor through the location.

This is a game-dialogue presentation, not a digital-human simulation. It does not require TTS, phoneme lip-sync, or per-response video generation.

## Required animation set

1. `neutral_idle` — seamless subtle breathing and attentive gaze; default persistent state. Arms remain relaxed and essentially still; the withdrawn side-to-side arm swing is not part of the design.
2. `wave_hello` — full-screen entrance, looking into camera and waving hello; silent one-shot.
3. `generic_talking` — a complete five-second talking clip with restrained mouth-shape variation and authored closed-mouth pauses. Once started, the clip always finishes before returning to neutral, even if the streamed response ends earlier.
4. `smile_tap` — smiling with a small tapping/buoyant beat; silent one-shot. The exact tapping motion should be visually reviewed before final export.
5. `thumbs_up` — clear positive reaction; silent one-shot.
6. `point_right` — points to the avatar's right, which appears toward screen-left when front-facing; silent one-shot.
7. `sad` — readable but restrained sad reaction; silent one-shot.
8. `thumbs_down` — clear negative reaction; silent one-shot.

The duplicated thumbs-up request maps to the same `thumbs_up` clip. No additional emotions are required yet.

## Runtime contract

- The LLM may call only a constrained semantic tool, for example `trigger_avatar_emote({ emote })`.
- Allowed `emote` values are `wave_hello`, `smile_tap`, `thumbs_up`, `point_right`, `sad`, and `thumbs_down`.
- An emote interrupts/cross-fades from neutral, plays once, then automatically reverses or cross-fades back to `neutral_idle`.
- The model does not select animation filenames, timing, loop counts, or transition parameters.
- `generic_talking` is controlled by the application from text-stream lifecycle, not by the emotion tool.
- When streamed text begins, the client starts the five-second clip. Once initiated, that complete clip plays through and returns to neutral; stream completion does not cut it off early.
- Optional game-dialogue audio consists of short synthesized robot-like `da`/bleep sounds at a throttled character/word cadence. It does not reproduce the response as speech.
- If an emote is requested during text streaming, the client may finish the current sentence pause, play the silent emote, then resume talking if the response is still streaming.
- Blinking may be baked naturally into a reviewed talking clip or scheduled independently for a model-based runtime. It must not produce prolonged closure or reset visibly at a loop boundary.

## Embedded face attachment contract

- Facial artwork used by an exported avatar GLB must be an actual mesh inside that GLB. Do not recreate or mirror the face with a separate Three.js canvas at runtime.
- Fit each new face manually against the visible head in Blender. The artist-approved location, rotation, scale, and depth are authoritative; do not replace that fit with bounding-box, bone-origin, shrinkwrap, or procedural surface estimates.
- After approval, preserve the exact object transform and weight every facial-mesh vertex 100% to the avatar's `Head` joint through the same armature used by the body animation. Lock location, rotation, and scale against accidental editing.
- Export the body, active armature Action, and embedded face together. Validate that the face node is skinned, every exported face vertex has total Head influence `1.0`, the expected texture is embedded, and no runtime face overlay remains.
- Future facial states reuse the same approved mesh transform and attachment. Change texture/material state or an explicitly reviewed facial mesh, not its spatial fit.

## Canonical neutral bookends

- One frame of `neutral_idle` is designated as the canonical transition pose.
- The first and last keyed frames of every loop and one-shot must exactly match that canonical pose—not merely look similar.
- Matching properties include root position/rotation/scale, planted foot transforms, hips and spine, shoulders, arms, hands and fingers, neck/head/gaze, and the closed-mouth facial state.
- Each one-shot includes a short authored ease-out from neutral and ease-in back to neutral. The expressive peak occurs only between those handles.
- `generic_talking` begins and ends in the canonical neutral pose with the mouth closed. Its internal sentence pauses may settle toward neutral without necessarily reaching the exact bookend frame.
- Root motion is forbidden unless a later clip explicitly requires it; any such clip must still return to the canonical root transform on its final frame.
- Export validation compares the first and last transforms against the canonical pose numerically and fails the asset if they drift beyond tolerance.
- Runtime cross-fades are still used, but they polish an already compatible pose transition rather than hiding mismatched animation endpoints.

## Five-second talking specification

- The authored clip is 121 frames at 24 fps, approximately 5.04 seconds.
- Once started, the entire clip plays; it is not cut or stretched to match response duration.
- Mouth movement includes restrained small-open, wider, and rounded shapes plus authored closed-mouth pauses so it does not chatter mechanically.
- Mouth motion is intentionally generic, visibly alternating between closed and small-open shapes. It does not need to match phonemes.
- Hands remain outside the thigh silhouette and do not move or gesture.
- Feet remain planted with no root translation.
- The clip begins and ends in the numerically identical canonical neutral pose with the mouth closed.

## Authoring and review

- Generate and deliver review videos at 1080p. Current portrait source framing maps to 1080×1440.
- Use retargeted API presets where their acting fits, then trim and polish them in Blender. Do not accept an exaggerated preset solely because it is available.
- Use a dedicated visible mouth mesh, texture/sprite swap, or graphic mouth layer over the neutral idle; the rejected subtle facial deformation must not be reused.
- Keep the avatar separate from map landmark interaction bounds and raycasting.
- Export every animation as an individual review video before runtime integration.
- Approve `neutral_idle` and `generic_talking` first. Only then produce the silent emotes.

## Quality gate

The neutral/talking pair must demonstrate stable hands, readable mouth opening at actual display size, natural sentence pauses, a clean loop seam, and an exact return to the canonical neutral pose. Each later emote must have a readable silhouette, play once without foot sliding, and pass the numerical neutral-bookend comparison.
