# Performance and zoom audit

- Reduced and accelerated the empty-map blocked zoom from 334 ms / 1.08x to 260 ms / 1.035x.
- Anchored the rejection pulse toward the pointer's ground-plane position and shortened gesture settling to allow reliable repeat attempts while still absorbing trackpad momentum.
- Stopped allocating landmark root arrays and linearly searching landmarks during each pointer raycast.
- Switched the expensive city shadow map from every-frame regeneration to demand updates for loading geometry and landmark lift motion.
- Started nearest city-tile loading before synchronous ambient/landmark construction so tile network and decode overlap startup CPU work.
- Added reusable caching for stable JSON datasets; retained immutable content-versioned city-tile caching.
- Confirmed gzip production transfers: runtime metadata ~275 KiB and planimetrics ~383 KiB; the Three.js/application client chunk is ~676 KiB uncompressed.
- `npm run lint`, `npm run build`, and `git diff --check` pass. In-app visual automation was unavailable in this environment, so final feel/gesture verification remains a manual browser check.
