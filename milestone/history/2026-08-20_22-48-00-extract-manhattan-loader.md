# Extract Manhattan loading and runtime disposal

- Moved road, CityGML tile, dataset, park, landmark, route, ambient, and staged reveal loading from the React runtime into a typed Manhattan loader.
- Isolated shared Three.js scene/resource disposal.
- Reduced `map-runtime.tsx` from 1,428 to 1,090 physical lines.
- Lowered the authored-file ESLint cap from 1,400 to 1,100 effective lines.
- Verified the complete repository with TypeScript and ESLint.
