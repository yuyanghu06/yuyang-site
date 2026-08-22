# Head-weighted face centering

Visual review rejected the first Head-bone-origin face centering and 4%-of-height downward camera adjustment. Inspection of `public/animations/idle.glb` found that vertices carrying at least 50% Head influence have an X bounding-box center of `-0.004892`, while the Head bone origin is effectively X `0`.

The runtime now deforms those Head-weighted vertices through the active `SkinnedMesh`, measures their world-space bounds, and uses the resulting visible skull center for facial-canvas placement. The canvas keeps its local-origin pivot and Head parent so head rotation and bobbing remain synchronized.

The camera target is now 68% of avatar height above the measured lower bound instead of the original 56%, making the requested downward character shift visibly stronger without changing orthographic scale.

Targeted ESLint, TypeScript, and whitespace checks pass.
