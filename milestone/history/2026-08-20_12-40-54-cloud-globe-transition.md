# Cloud-covered globe transition

- Corrected the New York destination marker to the sphere texture's longitude convention.
- Replaced the ring marker with a small white dot, leader, and `New York City` label; all marker elements now obey globe depth occlusion.
- Replaced the direct globe cut with a two-stage flight: globe approach, opaque moving cloud cover, hidden camera swap, then Manhattan pullback through thinning cloud.
- Replaced patterned star placement with deterministic pseudo-random placement and two crisp pure-white size layers.
- Verified ESLint, TypeScript, and the optimized production build.
