# San Diego detailing and camera QA

The user requested a full visual/detailing pass, particularly no plain-green out-of-bounds framing, no ground artifacts, and consistent map style.

- Replaced contain-fit region/district framing with viewport-footprint coverage constraints on every displayed pose, including transitions, resize, and globe handoffs. Tightened depth planes and kept labels and the phone waterfall visible.
- Corrected regional palette semantics, old-patch terrain seam, sloped building foundations with level roofs, bridge approaches, and tree exclusions. Rebuilt coastline from its connected mainland chain and five tidal islands to remove northern-estuary water/ground striping.
- Reduced San Diego shadow sampling radius and added receiver bias to remove repeating roof/facade stripes. New York settings and the original Torrey Highlands model bytes are unchanged.
- Wrapped compact San Diego destination choices so all districts, Back, and Reply remain reachable.

Final regional GLB: 24,926,960 bytes, 2,076,717 triangles, SHA256 `b3816aa90ca77f2d7363a4ae0e0cb2accc0b5c139713ff97db07de28fed1ac76`. Offline repeat regeneration is byte-identical. Original source, manifest, layout, and GLB are preserved.

Checks passed: TypeScript without incremental output, targeted ESLint, whitespace, independent camera/depth/label/navigation/input review, decoded finite geometry, shoreline classification, terrain continuity, 239,935 foundation samples, roof heights, palette parity, and tree exclusions. The camera sweep covers seven screen sizes and animated transitions, with zero coverage escapes across 18,704 poses / 149,632 corner rays. Browser review covers all six San Diego states, responsive controls, and phone waterfall visibility; screenshots accompany the chat review.

Physical multitouch and low-end-device performance remain unmeasured. The existing avatar preview can disappear following emulated viewport resize; this map pass did not alter its renderer. No production build, commit, push, or deployment. Continue with visual approval and physical-device assessment.
