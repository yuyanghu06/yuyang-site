# Talking playback contract

- Accepted the natural facial performance in `yuyang-avatar-talking-540p-v2.mp4` as the talking direction.
- Talking is intentionally not lip-synced or frame-matched to streamed-response length.
- Once triggered, the complete five-second talking clip plays through even when the LLM response lasts only about two seconds, then returns to neutral.
- This removes the need for arbitrary mid-clip cuts, closed-mouth exit markers, or hardcoded mouth overlays.
