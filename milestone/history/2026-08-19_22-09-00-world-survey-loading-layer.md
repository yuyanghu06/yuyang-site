# World survey loading layer

- Added an immediate, low-cost world-space white grid that expands from the active square while city assets decode.
- Added corner-bracket markers for the 32 nearest building tiles in center-out order.
- Markers dissolve individually when their matching GLB is decoded; the grid fades after all marked tiles resolve.
- Preserved the existing gray, roads, ordinary buildings, custom buildings, birds, and navigation-arrow staging.
- Verified ESLint, TypeScript, and the optimized production build.
