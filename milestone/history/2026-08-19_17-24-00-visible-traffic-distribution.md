# Visible traffic distribution

- Replaced random road-route selection for the 100-car fleet with deterministic round-robin assignment across spatially ordered verified routes.
- Staggered repeated-route phases to prevent cars from overlapping and visually disappearing into clusters.
- Slightly enlarged the low-LOD chassis/cabins and increased light/dark vehicle contrast for overview readability.
- Preserved road containment, building-clearance validation, route-aligned headings, animation, and the every-third-car yellow taxi rule.
- `npm run lint` and `npm run build` pass.
