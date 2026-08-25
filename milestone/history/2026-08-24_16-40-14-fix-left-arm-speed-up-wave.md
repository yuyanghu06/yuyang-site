# Fix viewer-left arm and speed up wave

The first-load wave runtime now freezes the arm on the viewer's left (the avatar's right shoulder-through-fingers chain) to the approved idle opening pose. Only the viewer-right/avatar-left arm chain retains the source wave rotation.

The wave's keyframe times and clip duration are scaled for 1.3× playback, reducing the 2.5-second source to roughly 1.92 seconds while preserving the exact idle bookends. The source GLB and idle animation remain unchanged. ESLint and TypeScript checks pass.
