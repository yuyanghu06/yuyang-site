# Linear docked avatar scale

- Added an independent CSS scale transition to the persistent avatar canvas.
- The expanded character remains at 100%; minimizing linearly reduces it to 75% over the existing 460 ms shell transition.
- Position movement retains its authored easing, and no camera, GLB, mixer, or WebGL-buffer changes occur.
