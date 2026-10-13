# Map architecture

`map.tsx` is the thin public entry point and `map-shell.tsx` is the browser-only loading boundary. The shell imports its scene presentation from `src/styles/map-shell.css`. Production's shell owns the five-second world-loader timer and preserves a 380 ms exit fade after the CTA gesture while priming dialogue audio; development bypasses the loader. The persistent React lifecycle is implemented under `runtime/` and coordinates one shared renderer across globe, Manhattan, Washington Square, Union Square, and San Diego.

Add new behavior to its owning system instead of growing the runtime component indiscriminately. The San Diego scene uses its own local coordinates and scene visibility; New York's geometry must never share its visible local space. San Diego uses fixed authored cameras and guided navigation. Its temporary free orbit/tilt/pan/zoom and Reset/Copy panel are disabled by the runtime helper’s authoring flag. The generated San Diego model uses a sage/green landscape with warm buildings while retaining the same geographic geometry.

## Direct subfolders

- `animation/` updates arrivals, markers, landmarks, clouds, travelers, and adaptive render resolution.
- `globe/` builds the Earth, stars, and city destination markers.
- `interaction/` routes pointer, wheel, pinch, keyboard, and hit-testing behavior.
- `manhattan/` owns New York geography, landmarks, loading, navigation helpers, and ambient activity.
- `runtime/` composes persistent rendering, city navigation, lifecycle, and disposal.
- `san-diego/` loads the generated Torrey Highlands region and its merged Westview High School and plaza landmarks.
- `shared/` provides common types, geographic framing, and rendering helpers.

## Direct files

- `map-shell.tsx` owns the client-loading boundary and introductory loading screen.
- `map.tsx` exports the persistent map runtime.
- `info.md` is this folder's guide.
