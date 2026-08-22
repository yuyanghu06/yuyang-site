# Restore latest-caption visibility guard

- Restored the rule that a sole caption cannot scroll out of view.
- Longer histories now clamp against live element offsets between the intended half-previous/full-latest state and latest-at-top state.
- Avoided the removed ResizeObserver and stored-coordinate approach that previously caused clipping and jumps.
