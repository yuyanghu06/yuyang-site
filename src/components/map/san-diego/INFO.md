# San Diego map

This folder loads the local Torrey Highlands scene into the site's persistent map runtime. Coordinates are meters from longitude −117.1518, latitude 32.9606, with east +X, north −Z, and up +Y.

There are no direct subfolders.

- `load-scene.ts` revalidates the generated manifest on each new scene load, fetches the Meshopt GLB with its content hash as the cache key, supports cancellation and failed-load cleanup, and exposes the two merged selectable landmark meshes plus overview framing and attribution. Manifest revalidation prevents the site's long-lived JSON cache from retaining an obsolete GLB hash after regeneration. The loader makes no requests to live geographic services.
- `INFO.md` is this folder guide.

The generator is `scripts/map-data/build-san-diego.mjs`; source data and provenance are in `public/data/san-diego/` and the model is in `public/models/san-diego/`.
