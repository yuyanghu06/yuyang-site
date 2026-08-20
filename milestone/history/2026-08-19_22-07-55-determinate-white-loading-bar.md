# Determinate white loading screen

- Replaced the abstract street-plan loader with a plain white full-screen field and centered two-pixel charcoal bar.
- Connected the bar to real renderer, data, roads, tiles, routes, landmarks, and final-frame milestones; parallel completion cannot move it backward.
- At full-scene readiness, the bar completes, the white field transitions to project gray, and the veil fades to the mounted canvas.
- Preserved full-scene gating and error release behavior.
- ESLint, TypeScript, and the optimized production build pass.
