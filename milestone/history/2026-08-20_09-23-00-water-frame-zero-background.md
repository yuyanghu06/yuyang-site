# Water as the frame-zero background

- Removed all water clipping, opacity, and positional arrival behavior.
- Frame review showed the remaining flash occurred when the gray server shell/WebGL clear color was replaced by dark water on the first canvas frame.
- Changed the HTML shell background and Three.js scene clear color to the exact water color `#354345`.
- The ground datum now springs over persistent frame-zero water, so river pixels never change color during renderer mounting.
- ESLint, TypeScript, and the optimized production build pass.
