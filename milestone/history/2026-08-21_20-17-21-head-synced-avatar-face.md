# Head-synced avatar face

The browser avatar's illustrated facial canvas now builds around its own local origin and is positioned in world space before attachment to the `Head` bone. This corrects the former world-coordinate pivot that made the face appear to bob or rotate separately from the skull.

Horizontal face centering now uses the Head bone's measured world position instead of the full avatar bounding-box center, which could shift with an asymmetric animated pose. The existing avatar-relative face size and vertical/depth fit remain intact.

The full-screen camera target moved from 56% to 60% of measured avatar height, lowering the complete character in the visible composition without changing its orthographic scale.

Targeted ESLint, TypeScript, and whitespace validation pass for the runtime changes.
