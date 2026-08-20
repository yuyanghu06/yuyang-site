# Full-datum building and road coverage

- Confirmed that the apparent East Side road void corresponds in part to real superblock/park street geometry, but was visually exaggerated because the building crop ended there.
- Expanded both CityGML building loading and NYC planimetric roadbeds to the full 2,600-meter radius of the visible 5.2 km datum.
- Rebuilt 17,373 buildings into 484 spatial tiles and 3,644 roadbed polygons into the 1.2 MiB road GLB.
- Raised the road source query limit from 5,000 to 50,000 to prevent outer features from being silently omitted.
- Bumped the asset version and passed the production build.
