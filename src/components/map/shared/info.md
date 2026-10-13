# Shared map infrastructure

Cross-view types, constants, logging, renderer creation, and frame composition live here. There are no direct subfolders. Keep this layer view-neutral and preserve one renderer across cities.

## Direct files

- `core.ts` defines geometry contracts, shared animation and New York framing constants, and the New York/San Diego `CityOverview` type. `MapView` derives from the authoritative camera registry's `GeographicMapView`, including all three San Diego districts.
- `rendering.ts` creates the persistent renderer and renders the selected city's scene. All San Diego views omit the New York-only sky overlay through the shared city classifier, preventing overlapping local coordinates from mixing city visuals.
- `info.md` is this folder guide.
