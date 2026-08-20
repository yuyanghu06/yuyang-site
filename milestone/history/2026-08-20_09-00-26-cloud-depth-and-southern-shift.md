# Cloud depth and southern shift

- Diagnosed broken white crescent artifacts as city geometry depth-occluding the centers of low northern clouds.
- Made cloud materials a non-depth-tested, non-depth-writing sky layer and assigned their lobes a late render order so formations remain visually whole above the city.
- Shifted all five southern cloud lanes 300 map units farther south to fixed Z positions from 1060 through 1810.
- Confirmed `npm run lint` and `npm run build` pass.
