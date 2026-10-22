# Map architecture

The San Diego runtime initially loads only a compact derived overview, then lazily prepares original Torrey Highlands or regional detail for the requested district. Both exact source layers cache for revisits and hide whenever the base overview is shown. Original detail retains four merged selectable landmarks and population, cached static matrices/bounds and the original light shadow policy. Its circular tour follows the current district/school route. Symmetric city loading, mobile quality limits and deferred compact city audio remain integrated.

`map.tsx` is the thin public entry point and `map-shell.tsx` is the browser-only loading boundary. The shell imports its scene presentation from `src/styles/map-shell.css`. Production's shell waits for the runtime's globe model and first rendered frame, then preserves a 380 ms exit fade after the CTA gesture while priming dialogue audio; development bypasses the loader. City asset loading and New York ground/waterfront construction start only on navigation intent. New York uses one compact overview plus roads before the cloud reveal, then bounded exact neighborhood detail on demand. Both cities hold the opaque cloud veil until prepared geometry is ready, and Manhattan lands at the final authored zoom 0.3. The persistent React lifecycle is implemented under `runtime/` and coordinates one shared renderer across globe, Manhattan, Washington Square, Union Square, and the San Diego region with three district views.

Add new behavior to its owning system instead of growing the runtime component indiscriminately. The San Diego scene uses its own local coordinates and scene visibility; New York's geometry must never share its visible local space. San Diego uses fixed authored cameras and guided navigation. Its temporary free orbit/tilt/pan/zoom and Reset/Copy panel are disabled by the runtime helper’s authoring flag. The generated San Diego model uses a sage landscape and warm buildings. San Diego camera coverage is constrained to mapped terrain and bounded ocean at every rendered pose, including zoom transitions and viewport changes; responsive views crop outer context rather than exposing empty green skirts. Tight camera depth planes preserve small ground-layer separation, and tailored shadow sampling avoids surface stripes. The original Torrey Highlands asset bytes and merged landmarks remain unchanged; district loading preserves their authored road geometry without runtime road-bend repairs.

## Direct subfolders

- `animation/` updates arrivals, markers, landmarks, clouds, travelers, and adaptive render resolution.
- `globe/` builds the Earth, stars, and city destination markers.
- `interaction/` routes pointer, wheel, pinch, keyboard, and hit-testing behavior.
- `manhattan/` owns New York geography, landmarks, loading, navigation helpers, and ambient activity.
- `runtime/` composes persistent rendering, city navigation, lifecycle, and disposal.
- `san-diego/` loads the generated Torrey Highlands region and four merged landmarks: Westview High School, Torrey Highlands Plaza, Mesa Verde Middle School, and Deer Canyon Elementary School. Its lazy population uses the same shared low-poly people and cars as New York with independent school-focused placement and an ordinary-car palette without taxis.
- `shared/` provides common types, geographic framing, rendering helpers, and reusable instanced pedestrian/car models used by both cities.

## Direct files

- `map-shell.tsx` owns the client-loading boundary and introductory loading screen, driven by actual globe render readiness instead of a fixed delay.
- `map.tsx` exports the persistent map runtime.
- `info.md` is this folder's guide.

San Diego now owns a separate sky overlay with map-anchored, overview-only NYC-style clouds/planes and fixed district bird routes, screen-visible bobbing pins and small GPU-animated ocean crests confined to Torrey Pines. Regional/scenery text annotations are removed, while globe labels and named tour controls remain.
