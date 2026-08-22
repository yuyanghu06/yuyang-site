# Independent talking mouth and blink

- Replaced whole-face talking-atlas swaps with a runtime 512×512 compositing canvas on the existing Head-skinned face mesh.
- Derived four transparent mouth-only assets from the approved atlas so speech cannot alter the approved eyes, brows, or nose.
- Kept the five-second blink clock active independently during both idle and speech.
- Changed speech to start immediately on a wide-open mouth and advance every 80 ms, with only one brief closed-mouth state per eight-state cycle.
- Rebuilt the closed-eye texture with transparent eye cutouts and explicit dark-brown eyelid curves, removing the black eye rectangles seen in review.
- Targeted ESLint and full TypeScript checks pass.
