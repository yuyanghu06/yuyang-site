# Add background chiptune playlist

- Added the four user-provided MP3s to `public/audio/` with stable site-facing filenames and preserved source encoding.
- Added an experience-gated, site-wide background playlist at volume `0.06` that remains continuous across every geographic and landmark view.
- Ordered the tracks as 4:16 Chiptune → Platform Shoes → Pixel Dreams → Exploration Chiptune, then wrap.
- Reused the shared exponential fade primitive for three-second crossfades and guarded delayed browser play promises against stale restarts.
