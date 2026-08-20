# Persistent map caching architecture decision

The future site loading model is now authoritative:

- Keep one Three.js canvas, renderer, scene, and React mount alive across globe, city, and neighborhood levels.
- Permit one blocking loader only during the initial website startup, held until a complete first scene is ready.
- Track geographic assets separately as downloaded, prepared, and visible.
- Preload and decode likely destinations in the background based on camera destination and user intent.
- Use globe-to-city and city-to-neighborhood camera flights as preparation time, then reveal prepared geometry without another blocking loader.
- Bound concurrency, yield CPU work, pause new preparation in hidden tabs, and evict distant decoded/GPU geometry under a memory budget while preserving browser-cached downloads.
- Treat the current direct-to-Washington SVG loader as temporary prototype infrastructure, not the architecture to optimize further.

Future caching implementation should begin from this contract.
