# Landmark camera scroll transfer

## Change

- While a landmark camera is locked, inward scrolling over a different interactive landmark now selects that landmark directly.
- The transfer reuses the existing `selectLandmark` route, preserving grounded bounds and the destination building's authored azimuth, height, radius, and zoom values when defined.
- Inward scrolling over the already selected landmark or empty map does nothing; outward scrolling still returns to the neighborhood overview.

## Verification

- `npx eslint src/components/map/interaction/input-controller.ts`
- `npx tsc --noEmit`

Both checks pass. A full production build was intentionally deferred under the repository's incremental verification cadence.
