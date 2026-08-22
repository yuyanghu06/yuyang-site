# Frame animation systems

Independent per-frame systems live here: globe-cloud motion, globe planes and boats, landmark glow/lift, travelers, navigation and destination markers, spring arrivals, and adaptive resolution.

Keep each system focused and pass explicit state rather than reaching into React lifecycle ownership.

## Files

- `adaptive-resolution.ts` adjusts renderer pixel ratio according to frame timing.
- `arrivals.ts` advances spring-based object arrival motion.
- `globe-clouds.ts` moves cloud formations around the globe and keeps them tangent to its surface.
- `globe-travelers.ts` creates and animates six globally distributed planes, nine ocean boats whose hull bottoms are scale-aligned to the imported model's inset water radius, and four satellites above the cloud layer, cloning shared model templates to keep the expanded ambient layer lightweight.
- `landmarks.ts` animates interactive landmark glow and lift states.
- `markers.ts` animates navigation and destination markers.
- `travelers.ts` advances Manhattan and neighborhood ambient travelers.
- `info.md` is this local ownership guide.
