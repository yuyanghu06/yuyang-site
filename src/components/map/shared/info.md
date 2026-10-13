# Shared map infrastructure

Cross-view types, constants, logging, renderer creation, and frame composition live here. There are no direct subfolders. Keep this layer view-neutral and preserve one renderer across cities.

## Files

- `core.ts` defines geometry contracts, shared animation and New York framing constants, all geographic `MapView` values, and the New York/San Diego `CityOverview` type.
- `rendering.ts` creates the persistent renderer and renders the selected city's scene. San Diego deliberately omits the New York-only sky overlay, so overlapping local coordinates cannot mix city visuals.
- `info.md` is this folder guide.
