# Manhattan loading

This directory owns staged Manhattan and neighborhood loading: road GLBs, CityGML tiles, runtime datasets, parks, landmarks, routes, ambient populations, and reveal ordering.

Keep network/decode work bounded and visibility-aware. Preserve destination-generation cleanup guards, cache versions, and merged landmark geometry.

There are no direct subfolders.

- `info.md` is this folder guide.
- `manhattan-loader.ts` owns staged map asset loading and guards pedestrian updates to Washington/Union and traffic to the three NYC views; hidden San Diego/globe views do not update NYC street-life instance matrices.

The loader starts only with the first New York visit and returns a boolean readiness promise after initial roads/tiles, essential park geometry, and all six merged landmark roots are registered. The first-entry cloud veil waits for this result; later neighborhood tile requests keep the existing bounded batches and eviction behavior. Initial failures abort the load's own controller and settle every in-flight tile batch, road decode and custom landmark request before runtime rollback/retry. Results arriving after teardown dispose their geometry/materials rather than mounting. Prepared trees and fountains mount invisibly before awaits so cleanup also owns their resources; replaced road materials are released.
