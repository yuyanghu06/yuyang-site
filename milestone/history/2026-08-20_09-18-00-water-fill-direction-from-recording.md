# Water fill direction from recording

- Reviewed the supplied 4.1-second OBS recording frame-by-frame at eight frames per second.
- Confirmed the river was not repeatedly blinking; its clipping plane traversed the huge off-screen outer-water area first, then reached the narrow visible Hudson strip near the end and looked like a single-frame pop.
- Reversed the Hudson clipping plane and retained the corresponding opposite East River direction so both fills begin at their visible shoreline and expand outward.
- ESLint, TypeScript, and the optimized production build pass.
