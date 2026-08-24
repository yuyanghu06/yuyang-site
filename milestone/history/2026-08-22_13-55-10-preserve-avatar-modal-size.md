# Preserve avatar modal size while fixing right edge

- Restored the expanded desktop modal's original bounded `min(76rem, ...)` width after the prior correction unintentionally stretched it across the viewport.
- Kept the modal's width unchanged while aligning it two pixels from the right viewport edge.
- Retained the full-width narrow-screen behavior and left the avatar camera, modal height, captions, and docked view unchanged.
