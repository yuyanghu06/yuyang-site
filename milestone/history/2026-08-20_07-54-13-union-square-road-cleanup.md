# Union Square road cleanup

- Traced the malformed-looking Union Square street network to ambient path extraction, not the NYC roadbed GLB.
- Updated `validateParkPaths()` so a segment's center and both full-width edges must remain inside a mapped park polygon at all five longitudinal probes, in addition to remaining outside roadbeds.
- Regenerated `src/generated/ambient-layout.ts`; the validated path set dropped from 1,200 to 919 segments, removing 281 out-of-park sidewalk/footway segments while preserving internal park paths.
- Verified the corrected Union Square plan offline and confirmed `npm run lint` and `npm run build` pass.
