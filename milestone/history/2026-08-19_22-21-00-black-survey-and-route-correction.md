# Black survey and route correction

- Changed the survey lattice and tile-corner markers from white to black while retaining their restrained opacity and timing.
- Removed the accidentally restored `src/app/union-square/page.tsx`; the intentionally shared single-page implementation and existing rewrite remain authoritative.
- Verified ESLint, TypeScript, and the optimized production build. Only `/` and `/_not-found` are emitted as static App Router routes, as intended.
