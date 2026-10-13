# Runtime map data

Tracked JSON datasets consumed by the browser live here. Most are reproducible outputs of `scripts/map-data/`.

Preserve the Washington-origin coordinate system for New York assets. San Diego has a separate documented Torrey Highlands origin; never mix the two local coordinate systems. Preserve each dataset's version/cache contract when regenerating it.

## Direct subfolders

- `san-diego/` contains the generated Torrey Highlands geography and source/projection metadata used by the San Diego scene.

## Direct files

- `manhattan-model.json` stores the Manhattan overview model dataset.
- `manhattan-parks.json` stores the generated Manhattan park surfaces.
- `manhattan-planimetrics.json` stores roadbed polygon geometry used to generate the road GLB.
- `nyc-lower-manhattan.json` stores the source-derived lower Manhattan map dataset.
- `union-square-park.json` stores Union Square paths and park geometry.
- `washington-square-addresses.json` indexes addresses for landmark association.
- `washington-square-citygml.json` stores Washington Square CityGML footprints and surfaces.
- `washington-square-park.json` stores Washington Square park paths and features.
- `info.md` is this folder's guide.
