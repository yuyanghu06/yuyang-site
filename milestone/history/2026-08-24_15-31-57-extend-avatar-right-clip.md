# Extend avatar right clipping edge

- Extended only the expanded avatar canvas's right edge to a `0.375rem` modal inset so the raised hand is no longer cut off.
- Preserved the existing canvas left edge and bottom-equivalent `translateY(-62%)` crop.
- Did not change the avatar mesh, Three.js camera constants, avatar scale, animation, modal dimensions, or docked presentation.
- Browser control was unavailable, so verification was limited to CSS inspection and targeted static checks.
