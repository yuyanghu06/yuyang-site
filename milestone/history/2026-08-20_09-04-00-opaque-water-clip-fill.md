# Opaque clipped water fill

- Replaced the whole-surface opacity fade with an opaque clipping-plane reveal for both rivers.
- Water stays fixed at its final position and full opacity while a vertical plane uncovers its footprint over 900 ms.
- Enabled renderer-local clipping; no transparent water/ground sorting is involved during arrival.
- ESLint, TypeScript, and the optimized production build pass.
