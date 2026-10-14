# San Diego map

This folder loads the local Torrey Highlands scene into the site's persistent map runtime. Coordinates are meters from longitude −117.1518, latitude 32.9606, with east +X, north −Z, and up +Y.

There are no direct subfolders.

- `load-scene.ts` revalidates the generated manifest on each new scene load, fetches the Meshopt GLB with its content hash as the cache key, supports cancellation and shared-resource failed-load cleanup, validates the population model hash and four unique merged landmark roots, caches culling bounds and static transforms, exposes a deferred population factory, and exposes all four selectable landmark meshes (Westview, the plaza, Mesa Verde, and Deer Canyon), overview framing, and attribution. Manifest revalidation prevents the site's long-lived JSON cache from retaining an obsolete GLB hash after regeneration. The loader makes no requests to live geographic services.
- `scene-resources.ts` precomputes geometry box/sphere bounds and freezes static local matrices while retaining dynamic landmark roots. It preserves the decoded scene’s existing shadow settings. Its San Diego glow shares each merged root's exact local geometry; the base and additive overlay move together, and shared disposal releases the geometry once.
- `population.ts` validates frozen spawn provenance against the loaded model and mounts two pedestrian meshes and two car meshes once. The population uses shared NYC geometry/materials and reveal animation, and is disposed with the city scene. School campuses hold 145 of 196 people and 40 of 70 cars; neighborhoods hold only 36 people and 24 cars.
- `car-spawn.ts` supplies separate San Diego routes and an ordinary-car palette with no yellow taxis. Cars never reuse NYC traffic placement or taxi colors.
- `INFO.md` is this folder guide.

The generator is `scripts/map-data/build-san-diego.mjs`; source data and provenance are in `public/data/san-diego/` and the model is in `public/models/san-diego/`.

Frozen spawn data lives in `src/generated/san-diego-people-spawns.ts` and `san-diego-car-spawns.ts`. After model regeneration, run the separate `data:san-diego:people` and `data:san-diego:cars` commands (or `data:san-diego:population`). These deterministic generators check mapped geometry offline and sample pedestrian ground support directly from the final GLB. Campus walkers avoid raised walking ribbons, complete cream road shoulders, and road traffic, neighborhood walkers stay on mapped paths at their actual 0.53 m surface, and cars sit on flat 0.5 m road surfaces; neither source nor layout JSON is fetched by the runtime.
