# Remove shell and unrendered-canvas flash

- Removed the remaining 220 ms white-to-background startup keyframe.
- Added the water color as the canvas CSS backing.
- Explicitly clear the WebGL drawing buffer to the water color before appending the canvas.
- This makes the HTML shell, unrendered canvas, and first rendered scene share one invariant background color.
- ESLint, TypeScript, and the optimized production build pass.
