# Consolidate site audio

- Added `src/components/site-audio.ts` as the sole owner of browser audio elements, levels, playback lifecycle, and cleanup.
- Moved map traffic, building crowd, globe-transition audio, dialogue blips, and dialogue-audio priming out of their prior callers.
- Added one cancellable, direction-aware exponential `fadeAudioVolume` primitive and reused it for 1.2-second traffic, 250 ms crowd, and 200 ms globe-transition envelopes.
- Map and chat callers now report state or request a blip without directly manipulating HTML audio.
- Targeted ESLint, TypeScript, and whitespace checks pass.
