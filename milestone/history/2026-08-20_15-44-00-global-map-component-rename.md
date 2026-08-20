# Global map component rename

- Renamed `src/components/nyc-3d-map.tsx` to `src/components/map.tsx` and its default component from `Nyc3dMap` to `GlobalMap`; using plain `Map` would shadow JavaScript's built-in keyed collection used throughout the scene.
- Renamed `nyc-3d-map-shell.tsx` to `map-shell.tsx`, updated its dynamic import, and changed the app page to render `MapShell`.
- The neutral naming reflects the Earth-scale persistent renderer and future San Diego and Beijing branches.
