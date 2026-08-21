# Thin map entry and extracted frame systems

- Moved both map entry and browser-only shell under `src/components/map/`; updated the App Router import.
- Reduced `map/map.tsx` to a three-line public entry and placed lifecycle orchestration under `map/runtime/`.
- Extracted globe-cloud, landmark, traveler, marker, arrival, adaptive-resolution, and final-render responsibilities from the frame loop.
- Lowered the authored JavaScript/TypeScript line cap from 1,600 to 1,400 effective lines.
- Added ownership guides for the new animation and runtime directories.
- Verified with TypeScript and ESLint targeted checks.
