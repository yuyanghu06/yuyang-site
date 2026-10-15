# San Diego dialogue

This folder groups San Diego camera dialogue. The regional overview and tour completion remain at the city root; each individual district or landmark camera has its own folder. `../index.ts` exports these scripts to the shared renderer. The overview offers Torrey Highlands, Park Village and Torrey Pines as entry areas. The circular tour visits Torrey Highlands → Deer Canyon → Mesa Verde → Westview → plaza → Park Village → Torrey Pines, skipping already visited stops and wrapping to the first unvisited location. All seven stops must be visited before completion; visit progress survives city changes and resets when a new tour invitation is accepted. Shared caption splitting, audio, Next/Back and Reply apply throughout.

## Subfolders

- `deer-canyon-elementary-school/` contains the elementary-school camera narration.
- `mesa-verde-middle-school/` contains the middle-school camera narration.
- `park-village/` contains the canyon and waterfall narration for the Park Village district camera; there is no separate waterfall destination.
- `torrey-highlands/` contains the neighborhood welcome and childhood/school context for the Torrey Highlands district camera.
- `torrey-highlands-plaza/` contains the plaza camera's after-school hangout narration and Chef Beric links.
- `torrey-pines/` contains the coastal beach, bluffs and lagoon district-camera narration.
- `westview-high-school/` contains the school and club narration and East Asian Student Union link.

## Files

- `san-diego.md` introduces the wider region and its three district choices.
- `tour-complete.md` contains the hometown thank-you and New York question. Completion offers New York and Globe only after all seven San Diego stops have been visited.
- `INFO.md` documents this folder.
