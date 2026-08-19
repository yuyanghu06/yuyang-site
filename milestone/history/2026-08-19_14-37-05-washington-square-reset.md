# Washington Square-only reset

Date: 2026-08-19 14:37 PDT

- Retired the previous atlas and four-view Manhattan runtime.
- Removed the atlas component and routed the homepage directly to one Washington Square scene.
- Rebuilt the Three.js component around a fixed orthographic camera with no user camera controls.
- Limited geographic rendering to Washington Square and nearby context buildings.
- Established white simplified context massing plus basic park, tree, fountain, and arch geometry.
- Replaced the accumulated global CSS with a minimal stylesheet for the single study.
- Confirmed `npm run lint` and `npm run build` both pass.
- Next step is visual review and correction of this small scene before any expansion.
