# Extract map input controller

- Moved pointer, touch, pinch, wheel, keyboard, hover, and click state into a typed interaction controller.
- Kept camera and geographic view mutations behind explicit callbacks owned by the runtime.
- Reduced `map-runtime.tsx` from 1,029 to 866 physical lines.
- Lowered the authored effective line cap from 1,050 to 900.
- Verified with TypeScript, ESLint, and the production build.
