# Water shader flicker removal

- Traced the remaining water load flicker to a displayed-color mismatch between the `#354345` clear buffer and lit, tone-mapped river materials.
- Replaced both river surface materials with a shared unlit, non-tone-mapped material that exactly matches the HTML, canvas, and renderer backing color.
- Kept the mapped water geometry continuously visible and left pier/waterfront arrival animation unchanged.
- ESLint, TypeScript, and the optimized production build pass.
