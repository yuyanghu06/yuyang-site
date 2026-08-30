# Manhattan view

Manhattan-level navigation and waterfront composition live here. Anything closer than the Manhattan overview belongs in a nested domain such as `ambient/` or `neighborhoods/`.

The renderer remains shared with the globe; do not create a second canvas or remount the scene between views.

## Direct subfolders

- `ambient/` owns Manhattan and neighborhood environmental populations and movement.
- `loading/` owns staged Manhattan and neighborhood asset loading.
- `neighborhoods/` owns close-view park and landmark construction.

## Direct files

- `info.md` is this folder guide.
- `navigation.ts` imports landmark IDs from the agent context registry, builds destination markers and landmark glow geometry, and owns the world-space neighborhood navigation arrow; interactive landmarks carry their shared registry camera-view ID.
- `waterfront.ts` builds the Hudson and East River surfaces and piers.
