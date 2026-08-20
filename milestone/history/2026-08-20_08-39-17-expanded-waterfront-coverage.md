# Expanded Manhattan waterfront coverage

- Expanded the official DA12 CityGML crop from 1,800 to 2,200 meters, producing 16,223 buildings in 421 spatial tiles so the building fabric reaches the waterfront road corridor.
- Expanded the NYC 2022 Planimetric Roadbed query to the same 2,200-meter footprint and rebuilt `manhattan-roads.glb` from 3,011 roadbed polygons, extending the West Side Highway and matching the new building coverage.
- Retained the mapped OSM Hudson and East River shorelines and simple pier treatment.
- Added a restrained tree rhythm along the mapped Hudson waterfront/esplanade, explicitly skipping large discontinuities between shoreline fragments.
- Bumped the shared data asset version and verified the result with a successful production build.
