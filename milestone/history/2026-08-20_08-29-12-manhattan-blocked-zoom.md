# Session handoff: Manhattan blocked-zoom animation

- Restored the rejected scroll-in pulse for ordinary map space in the base Manhattan view.
- Changed the animation to scale from and return to the camera's current zoom instead of hard-coding the neighborhood zoom of `1`; Manhattan therefore pulses around its `0.3` overview zoom without snapping to a close view.
- Park-targeted scroll-in still enters Washington Square or Union Square normally, and trackpad momentum remains coalesced into one pulse per gesture.
- ESLint and TypeScript checks pass.
