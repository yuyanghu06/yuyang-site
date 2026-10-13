# San Diego Torrey Highlands view

Implemented a San Diego globe destination and screenshot-centered regional scene with Westview High School and the Chef Zhu plaza. Reused New York navigation, avatar captions, and audio; added placeholder scripts and agent destinations. The two landmark roots merge buildings, roofs, and window details. San Diego camera fitting is responsive and its geometry/picking remain separate from NYC.

Map3D is cloned and pinned in ignored `data/work/map3d/`. `npm run data:san-diego` reproducibly generates real OSM footprints, streets, parks, sports/parking surfaces, bridge levels, and deterministic vegetation. Final scene: 2,637 buildings, 1,092 roads/paths, 804 trees, six meshes, 3,606,552 bytes, SHA256 `4aadfc991e3e32ca854acb092bd1706183486884166a054be569b8825a1fb0f9`. Source, projection, assumptions, layout audit data, and MIT notice accompany it.

Review fixes: preserve Float32 positions to prevent road/terrain z-fighting; revalidate the unversioned manifest before choosing its hash-versioned GLB; make San Diego Back traverse camera stops; defer scripted narration during agent replies; fit merged landmark bounds on narrow screens.

Verification passed: final production build with all 18 routes; TypeScript; targeted ESLint; deterministic regeneration; geometry/loader/abort checks; exhaustive tree clearance; destination/schema parity; route/caption checks; nine input routing assertions; independent evaluator review and twelve projected camera-fit cases. Desktop browser showed correct globe entry, overview geography, plaza selection, clean final surfaces, caption progression, and Westview framing. Browser control became unavailable before final mobile visual and live NYC return checks, which remain pending. Audio reuse/fades were checked programmatically, not by listening.

No commit or deployment. Shared documentation updated; existing orchestration/configuration changes preserved. Remaining: live mobile/NYC walkthrough, user visual review, and replacement of placeholder stories. Flat terrain, estimated missing building heights, and decorative vegetation are documented limitations.
