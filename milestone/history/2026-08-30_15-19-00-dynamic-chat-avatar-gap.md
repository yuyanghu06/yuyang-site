# Dynamic chat-to-avatar gap

- Replaced the fixed short-landscape avatar offset with a live dialogue-content measurement.
- Measures the latest card and direct controls whenever streaming or interaction state changes.
- Publishes a 12 px desired gap through `--expanded-avatar-top`.
- Clamps the resulting avatar anchor between 32% and 48% for safe framing.
- Leaves portrait-mobile and desktop placement unchanged.
