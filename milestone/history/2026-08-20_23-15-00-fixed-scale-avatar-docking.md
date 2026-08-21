# Fixed-scale avatar docking

- Reviewed the 23:09 and 23:11 transition recordings and removed the rejected resize/zoom behavior.
- The idle avatar now keeps one fixed orthographic camera, one fixed full-resolution WebGL buffer, and one fixed character scale across expanded and docked states.
- Docking changes only the shell bounds and the canvas position; the shell's overflow clips away the unused full-body area to expose the desired upper-body region.
- Removed per-frame renderer resizing and camera interpolation, which had caused blank frames, flicker, compression, and a grow-then-shrink pulse.
- Targeted ESLint and TypeScript checks pass.
