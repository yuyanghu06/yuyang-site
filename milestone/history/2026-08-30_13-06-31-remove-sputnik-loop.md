# Remove Sputnik loop

- Removed the globe-only looping Sputnik playback immediately after review.
- Removed its start-gate state, runtime audio element, per-frame updates, and teardown handling.
- Preserved all original, processed, and generated audio files as unwired references.
- Targeted ESLint and whitespace checks pass.
