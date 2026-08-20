# Build-time ambient layout

- Added `scripts/build-ambient-layout.mjs` and the `npm run data:ambient-layout` command.
- Ran the full spatial validation once and froze 184 trees, 600 pedestrian loops, 240 vehicle routes, and 1,200 accepted park-path segments in `src/generated/ambient-layout.ts`.
- Removed runtime tree rejection sampling, pedestrian-route validation, traffic-route validation, and park-path/roadbed intersection filtering.
- Removed the browser's 2.4 MiB planimetrics JSON request; the source remains available to the build-time validator.
- Verified with TypeScript, ESLint, and the optimized Next.js production build.
