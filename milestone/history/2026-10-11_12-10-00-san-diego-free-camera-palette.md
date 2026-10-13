# San Diego free camera and greener palette

User requested temporary free camera adjustment and less gray in San Diego.

Implemented SD-only orbit/tilt, pan, continuous zoom, touch gestures, Reset, and actual-pose Copy JSON with clipboard fallback. Manual poses stay put across resize and retain selected landmark/caption identity; explicit navigation restores authored presets. A single runtime flag disables authoring mode. Moved the control panel to the lower-left after desktop review caught social-link overlap. NYC and globe keep existing navigation.

Recolored generated landscape to sage/richer greens, cream walls/campuses, and terracotta roofs; pavement remains distinct. Matched SD background/light and extended its far plane. Model SHA256: `a7152380bc1a5e5e6ae90003507d12287cf32234b2f81fade26f51d835fce797`, 3,606,512 bytes. Exact decoded geometry, all source/layout data, counts, bounds, and merged landmark structure are preserved; regeneration is deterministic.

Verification: full TypeScript, targeted ESLint, independent asset and camera/input checks. Live desktop orbit/tilt/zoom/Reset/Copy/selection, viewport-change persistence, phone-size Westview/controls/one-finger movement, and SD-to-globe-to-NYC return reviewed. Modified-button and multitouch combinations use controlled event assertions rather than physical-device input. Prior full-tour mobile/audio-listening checks remain outstanding. No full production build, commit, or deployment for this follow-up.

Next: collect preferred framing with Copy view, apply approved camera presets, disable temporary mode, and replace placeholder stories.
