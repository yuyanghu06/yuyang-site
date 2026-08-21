# Avatar render overscan

- Identified the straight lower-torso edge as clipping at the avatar WebGL canvas boundary rather than modal spacing.
- Increased the canvas height and orthographic vertical span together by 20%, preserving apparent avatar scale while rendering additional lower-body content.
- Lowered the expanded avatar canvas by 10 percentage points from `translateY(-75%)` to `translateY(-65%)`.
- Left the modal geometry and minimized avatar transform unchanged.
- Targeted ESLint, TypeScript, and whitespace verification pass.
