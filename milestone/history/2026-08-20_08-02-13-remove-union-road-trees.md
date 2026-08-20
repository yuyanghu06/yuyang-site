# Remove Union Square road trees

- Identified 16 entries in the frozen Union/Gramercy tree set whose full canopy footprints intersected authoritative roadbeds.
- Added an explicit build-time exclusion set for those authored indices and regenerated `src/generated/ambient-layout.ts` with 80 Union/Gramercy trees.
- Confirmed the remaining frozen set has zero road-overlapping centers or 48-probe canopy footprints.
- No validation was added to page load; the browser continues to consume only the generated constant array.
- Confirmed `npm run lint` and `npm run build` pass.
