# Avatar glass remount hitch

The supplied 08:54:51 recording showed a small final pause only after the modal reached full size. The transition code was unmounting `simple-liquid-glass` during motion and recreating its SVG filter tree 40 ms after the resize ended.

The liquid-glass instance now remains mounted across expanded, transitioning, and docked states. During motion CSS hides it beneath the existing 12 px blurred placeholder; afterward the placeholder is removed and the already-built glass is revealed. Modal dimensions, placement, avatar framing, and blur strength are unchanged.

Targeted ESLint, TypeScript, and diff-integrity checks pass.
