# Manhattan loading

This directory owns staged Manhattan and neighborhood loading: road GLBs, CityGML tiles, runtime datasets, parks, landmarks, routes, ambient populations, and reveal ordering.

Keep network/decode work bounded and visibility-aware. Preserve destination-generation cleanup guards, cache versions, and merged landmark geometry.

There are no direct subfolders.

- `info.md` is this folder guide.
- `manhattan-loader.ts` owns staged map asset loading and guards pedestrian updates to Washington/Union and traffic to the three NYC views; hidden San Diego/globe views do not update NYC street-life instance matrices.
