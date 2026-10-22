# Shared map infrastructure

The shared classifier recognizes all three district views and all four Torrey Highlands landmarks, so picking, renderer overlay selection, navigation and audio consistently treat them as San Diego.

Cross-view types, constants, logging, renderer creation, and frame composition live here. There are no direct subfolders. Keep this layer view-neutral and preserve one renderer across cities.

## Direct files

- `core.ts` defines geometry contracts, shared animation and New York framing constants, all geographic `MapView` values, and the New York/San Diego `CityOverview` type.
- `gltf-loader.ts` contains the view-neutral GLB fetch/Meshopt decoder and resource-safe material replacement helper. Globe loading imports this module directly, keeping the large NYC ambient layout and detail factories out of its initial dependency graph.
- `street-life.ts` defines the shared NYC pedestrian/car geometry, clothing, materials, animation, staged reveal, visibility guards, and conservative culling envelopes, and optional per-spawn ground support heights (NYC defaults stay exact); each city supplies its own frozen routes and vehicle colors.
- `rendering.ts` creates the persistent renderer, reads browser device capabilities and composes each city's map with its own sky overlay. The runtime supplies separate New York and San Diego sky scenes and may pass a dedicated overlay camera to include San Diego's overhead clouds, planes and birds without mixing city visuals.
- `quality-profile.ts` computes view/device limits without browser dependencies: touch/coarse city views use native-bounded DPR 1–1.5, a 60 Hz interaction ceiling and a 1024-pixel San Diego shadow target. Desktop and globe retain their existing ceilings, including native ratios below 1. The short viewport edge covers phone landscape, while narrow desktop windows alone do not trigger the mobile profile.
- `info.md` is this folder guide.
