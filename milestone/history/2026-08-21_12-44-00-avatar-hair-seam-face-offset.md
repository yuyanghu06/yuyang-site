# Avatar hair seam and face offset

- Moved the approved face canvas downward by `0.0255` world units, exactly 10% of its `0.255` height, from Y `1.44` to `1.4145` without changing scale.
- Corrected the remaining tan sideburn triangle by traversing coincident split-vertex coordinates when growing the hair material assignment. The solid near-black hair material now covers 16,402 faces.
- Regenerated both idle and talking GLBs from the untouched pre-correction exports, retaining the 40° arms-at-sides correction, complete 54-bone hierarchy, all 30 finger bones, and downstream hand animation.
- Deployed behind cache key `20260821-flat-face-hair-seam-v3` pending visual review.
