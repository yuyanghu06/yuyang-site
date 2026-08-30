# Map architecture

`map.tsx` is the thin public entry point and `map-shell.tsx` is the browser-only loading boundary. The shell imports its scene presentation from `src/styles/map-shell.css`. Production's shell owns the five-second world-loader timer and preserves a 380 ms exit fade after the CTA gesture while priming dialogue audio; development bypasses the loader. The persistent React lifecycle is implemented under `runtime/` and coordinates one shared renderer across globe, Manhattan, Washington Square, and Union Square.

Domain code is split into `animation/`, `globe/`, `manhattan/`, `runtime/`, and `shared/`. Add new behavior to its owning system instead of growing the runtime component indiscriminately.
