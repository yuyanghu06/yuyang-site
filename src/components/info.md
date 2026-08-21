# React components

The complete map feature lives under `map/`. Its `map-shell.tsx` is the server-safe dynamic-loading boundary and `map.tsx` is the thin public entry point.

Keep browser-only Three.js behavior behind the client boundary. `avatar-idle-view.tsx` owns the FaceTime modal's live idle GLB, smiling atlas canvas, and studio shadow; `avatar-call.tsx` owns only the modal/dock interaction shell.
