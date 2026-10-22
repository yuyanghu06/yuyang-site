# Manhattan loading

This directory owns prepared Manhattan overview and exact neighborhood layers. There are no direct subfolders.

- `info.md` is this folder guide.
- `manhattan-loader.ts` exposes idempotent `ensureOverview` and `ensureNeighborhood` promises, readiness/visibility controls, cancellation and disposal. Constructing the controller starts no requests. First New York intent reads the revalidated overview manifest and loads only its content-hashed overview GLB plus exact stencil-first roads. The overview contains noninteractive city buildings and exact minimal park grass; the runtime restores the grass stencil state after decode. The browser never fetches the large `runtime.json`.

Washington/Union navigation lazily imports the ambient layout and geometry factories, reads compact content-hashed `details.json` and both small park datasets, and prepares unchanged merged landmarks, paths, trees, fountain, plaza/garden and population. Exact CityGML tiles are limited to the destination's 900-meter neighborhood and decoded four at a time. Geometry remains off-scene until every required tile/model succeeds. No tile arrival springs remain to stream beneath a reveal; the previous visible layer remains intact during preparation. Returning to Manhattan hides exact layers and restores the compact overview. Prepared exact tiles and both neighborhood readiness sets cache for revisits.

Requests deduplicate while pending, retry after failure, and reject superseded navigation. Partial landmark registration rolls back for a clean retry. Failed or late overview/road/tile/custom decodes and unmounted prepared detail are disposed, including after teardown; mounted layers belong to the runtime's shared scene traversal. Source groups used to bake selectable landmarks release their original geometry/material/instance buffers. Population updates only in visible neighborhood views.
