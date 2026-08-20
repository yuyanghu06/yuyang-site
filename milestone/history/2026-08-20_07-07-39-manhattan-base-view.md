# Session handoff: Manhattan base view

- Replaced Washington Square as the startup camera state with a Manhattan overview covering the existing 1,250-meter CityGML crop around Washington and Union Squares.
- Reused the approved warm CityGML palette, roadbeds, parks, and persistent Three.js scene; no alternate Manhattan renderer or dataset was introduced.
- Washington Square and Union Square are now child zoom views. Click or scroll inward over either park to enter it; scroll outward to return to Manhattan.
- Disabled landmark selection and close-view birds at Manhattan scale.
- Made the Manhattan camera angle fixed and, after correcting an overly top-down interpretation, increased its pitch to 50° away from straight down while preserving drag rotation in both neighborhood views.
- After the first live screenshot showed excessive sky/fog and the city compressed at the bottom, raised the camera to a more top-down angle, widened Manhattan fog, and enlarged the ground datum.
- Manhattan fog was briefly retightened to hide the exposed outer crop, then removed again at the user's request; neighborhood fog remains unchanged.
- Replaced the empty western datum with dark Hudson water generated from the real OSM coastline and rebuilt Pier 40 from its mapped multipolygon footprint and athletic field. Removed the later over-detailed track/road/trail pass and its circular spline artifact, retaining only a restrained tree treatment.
- Added the East River from its actual OSM coastline plus simple mapped pier areas and arms, intentionally avoiding bespoke detail for each individual pier.
- ESLint, TypeScript, and the optimized Next.js production build pass. The in-app browser was unavailable, so the latest framing adjustment was validated from the user-provided screenshot plus static/build checks rather than a second automated browser capture.
