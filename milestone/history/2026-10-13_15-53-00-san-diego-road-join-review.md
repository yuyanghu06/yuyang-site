# Final San Diego road-join review

The final close-up review found pale transverse wedges at bends in the original Torrey Highlands roads. These were gaps between perpendicular-ended ribbon segments, distinct from authored longitudinal lane dashes.

`road-joins.ts` reconstructs connected ribbon ends from the decoded street mesh and merges 7,735 small bevel triangles into that same noninteractive mesh. Matching width, color, elevation, and unique endpoint pairing preserve terminal ends, intersections, bridge levels, ramps, and lane dashes. Original GLB bytes, original vertex/index values, street bounds, and merged selectable landmark roots remain unchanged.

Independent review confirms exact former gap probes now hit asphalt, actual GLTF interleaved attributes work, caps stay bounded, and no map finding remains. Synthetic join cases, finite geometry, TypeScript, targeted ESLint, and whitespace pass. Fresh browser screenshots confirm smooth road bends and clean surfaces at both the plaza and Westview. All earlier region, camera, coastline, waterfall, and responsive-control checks remain valid.

The detailing pass is complete for visual review. Physical-device performance remains unmeasured; the separate avatar resize issue is recorded in the preceding handoff. No production build, commit, push, or deployment.
