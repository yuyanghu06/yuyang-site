# Guided-Tour Avatar Animation System

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
