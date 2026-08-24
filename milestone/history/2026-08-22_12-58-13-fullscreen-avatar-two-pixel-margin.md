# Fullscreen avatar two-pixel margin restoration

- Replaced the expanded avatar modal's desktop `2.5rem` right offset and asymmetric left constraint with a consistent two-pixel margin on both horizontal edges.
- Applied the same two-pixel edge policy below the responsive breakpoint so viewport scaling cannot select a layout that exposes a wide black strip.
- Preserved the modal height, vertical centering, avatar camera, caption layout, and docked presentation.
