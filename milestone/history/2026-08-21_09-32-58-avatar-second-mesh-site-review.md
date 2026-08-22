# Avatar second mesh site review

- Diagnosed the first welded candidate's remaining head/neck boundaries and found no safe near-coincident seam pairs: the closest open-boundary vertices are about 0.09 Blender units apart.
- Preserved the complete first-pass candidate as a separate ignored `.blend` recovery copy.
- Applied a second actual-mesh normal pass, extending rounded smoothing from 55° to 75° while retaining 8,859 sharp or boundary edges.
- Exported the second candidate directly into the site idle GLB and advanced the cache version for real-lighting validation.
- Verified the export retains one three-second idle animation with 162 channels, 162 samplers, and 1,360 keyframes.
- The authoritative Blender source remains unsaved and no animation video was rerendered.
- Targeted ESLint, GLB inspection, and diff validation pass.
