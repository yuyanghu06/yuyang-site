# Stream-safe caption scrolling

- Stopped streamed text deltas from resetting the caption history to its initial two-message anchor.
- Added caption resize observation that recalculates bounds while preserving current scroll progress.
- Retained standard direction: scroll down toward newest-at-top and up toward the partial preceding caption.
