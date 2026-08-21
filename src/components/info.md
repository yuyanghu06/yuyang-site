# React components

The complete map feature lives under `map/`. Its `map-shell.tsx` is the server-safe dynamic-loading boundary and `map.tsx` is the thin public entry point. Browser-only avatar rendering lives under `avatar-view/`.

Keep browser-only Three.js behavior behind the client boundary. `avatar-view/avatar-idle-view.tsx` owns the FaceTime modal's live idle GLB and smiling atlas canvas; `avatar-view/fixed-body-animation.ts` is the shared body-lock policy for current and future clips. `avatar-call.tsx` owns only the modal/dock interaction shell.
