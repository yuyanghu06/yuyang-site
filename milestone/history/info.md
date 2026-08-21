# Session history

This directory is an append-only project log. Meaningful sessions create one concise file named `YYYY-MM-DD_HH-MM-SS-short-description.md`.

Use these records only when historical context is needed; do not load the entire directory by default.

## Files

- `2026-08-21_08-04-13-avatar-call-camera.md` records the expanded avatar camera reframing and preservation of the original minimized camera and scale.
- `2026-08-21_08-14-48-shared-avatar-fullscreen.md` records the follow-up single-camera transition fix and separation of shared full-screen rendering from idle animation setup.
- `2026-08-21_08-40-12-avatar-glass-positioning.md` records the final fullscreen/minimized vertical offsets and the stable-size, lower-cost liquid-glass resize optimization.
- `2026-08-21_08-42-35-avatar-render-overscan.md` records the correction of the lower-torso cutoff through proportional vertical render overscan and the revised expanded placement.
- `2026-08-21_08-46-06-avatar-minimize-performance.md` records the removal of live refraction work from the modal resize interval to eliminate the observed minimize lag.
- `2026-08-21_08-49-41-avatar-transition-blur-and-margin.md` records the equal compact vertical modal margins and default-strength blur retained during minimize and restore.
- `2026-08-21_08-52-00-avatar-two-pixel-margin.md` corrects the modal margin interpretation to exact 2 px viewport margins and records the selected 12 px blur.
- `2026-08-21_08-58-00-avatar-glass-remount-hitch.md` records removal of the final full-size hitch by keeping the SVG glass instance mounted throughout the transition.
- Other timestamped Markdown files are earlier append-only session handoffs.
