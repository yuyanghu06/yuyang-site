# Shared map infrastructure

Cross-view types, constants, logging, renderer creation, and frame composition live here. There are no direct subfolders. Keep this layer view-neutral and preserve one renderer across cities.

## Files

- `core.ts` defines geometry contracts, shared animation and New York framing constants, all geographic `MapView` values, and the New York/San Diego `CityOverview` type.
- `street-life.ts` defines the shared NYC pedestrian/car geometry, clothing, materials, animation, staged reveal, visibility guards, and conservative culling envelopes, and optional per-spawn ground support heights (NYC defaults stay exact); each city supplies its own frozen routes and vehicle colors.
- `rendering.ts` creates the persistent renderer, reads browser device capabilities, and renders the selected city's scene. San Diego deliberately omits the New York-only sky overlay, so overlapping local coordinates cannot mix city visuals.
- `quality-profile.ts` computes view/device rendering limits without browser dependencies: touch/coarse city views use a 1–1.5 pixel ratio bounded by the browser's native ratio, a 60 Hz interaction ceiling, and a 1024-pixel San Diego shadow target; desktop and globe quality retain their existing ceilings, including native ratios below 1 when browser zoom reduces DPR. The short viewport edge covers phone landscape, and narrow desktop windows alone do not trigger the mobile profile.
- `info.md` is this folder guide.
