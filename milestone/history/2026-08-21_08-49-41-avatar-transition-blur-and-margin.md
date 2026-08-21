# Avatar transition blur and margin

The expanded FaceTime modal remains vertically centered, but its viewport-limited height now uses a compact height-based inset so the outside top and bottom margins are equal and smaller. Its width and 48rem maximum height remain unchanged.

The lightweight transition surface now keeps backdrop blur active throughout minimize and restore. Its blur is 2 px with 105% saturation, matching the effective blur of the default low-quality liquid-glass path instead of the overly strong 12 px first pass. The expensive SVG displacement remains disabled only during resizing.

Targeted ESLint, TypeScript, and diff-integrity checks pass. No full production build was run during this iterative visual adjustment.
