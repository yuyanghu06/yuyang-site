# San Diego overview and loader optimization

The user requested a broad local-dev performance/memory pass, especially avoiding full building geometry in the base San Diego view. Work stays on `dev`, initially clean at `3f3a164`, with no commit/push/deployment.

## Implementation

- New deterministic overview generator and content-addressed combined GLB/manifest, with independently visible original/regional proxy groups.
- Cold overview loads neither full model. Original detail/population/landmarks load for Torrey Highlands; regional detail for Torrey Pines/Park Village. Waves prepare at first Torrey Pines entry. Exact original/detail assets and interactions are preserved.
- Testable LOD lifecycle handles deduplication, atomic mounting, rollback/retry, superseded routes, late decode disposal, cached visibility and Escape during loading.
- New York loading cleans late/off-scene resources and replaced/merged sources and deduplicates overlapping tile requests without changing eager loading or visuals.
- Every changed folder guide and the root package-command guide is updated.

## Measured geometry

| Metric | Before | Overview | Reduction |
|---|---:|---:|---:|
| Triangles | 3,160,176 | 1,439,440 | 54.45% |
| Download bytes | 39,166,988 | 12,860,620 | 67.16% |
| Decoded geometry buffers | 125,741,556 | 39,632,670 | 68.48% |

Buffer counts include padded attribute strides, not renderer targets, drivers, JS objects or temporary decompression. Both visited detail sets remain cached: eventual combined geometry buffer capacity is 165,374,226 bytes. Only the correct representation draws. This intentionally optimizes initial loading and base-view rendering, while preserving fast revisits.

Same-camera isolated browser rendering (1280×720, DPR1, matching authored framing/lighting): 18 draws in each, median GPU3.933ms before/2.058ms after; 90 sampled frames after15warmups,88/89 usable GPU samples. No whole-app FPS/device-performance claim. The 70% triangle aspiration was relaxed after visual review to preserve layer alignment rather than over-simplify.

## Verification

- Full ESLint, `npx tsc --noEmit --incremental false`, whitespace and `npm run build` pass; production generates all18 static pages.
- Generator syntax/lint, byte-identical regeneration, finite indices/positions, source bounds and transforms, protected boundaries and exact output source position/color audit pass. Both full GLBs/manifests/layouts/spawn data remain unchanged.
- Actual-source harnesses in `/tmp/sd-optimization/` cover controller cancellation/dedup/retry/disposal, real GLB request isolation and roots/population/glow/waves, and actual runtime navigation. Parent reran the real-loader and runtime-navigation harnesses.
- `/tmp/yuyang-manhattan-lifecycle-check.cjs` passes11 async/resource-sharing/eviction scenarios and was independently rerun.
- Independent evaluator inspected actual source/assets and reran lifecycle checks, verified324 navigation pairs, source hashes, normals/flat shading, and no modified full detail assets. No actionable findings as of the integrated code review.
- Browser evidence and final independent signoff recorded below after final review.

## Artifact provenance and follow-up

Overview SHA256: `3833c64cb4a680d942baff81559a67641bbf8902dc011566ab7f3a207bd424e9`. Regenerate with `npm run data:san-diego-overview` after either full model changes; loader rejects stale overview provenance. The full models remain original `eca6e8141563ba184bd4f45c5e5712a1ac0af367f181eb2774cf6ead134e295d` and region `aa015d1b40c4a100877eb2909891ed7d95075d638c2182cc235aa91ea449a901`.

Keep current local changes for user review. Physical touch/Safari, phone GPU and subjective listening are unmeasured. Full regional close-up geometry and eager NYC loading are retained; memory-budgeted detail eviction is a possible later optimization. Temporary QA scripts/server/logs are outside the repository. User's existing port3000 dev server remains running.

## Final integrated review

Independent evaluator reports no actionable findings and has read final documentation. Parent browser review at1280×720 confirms the simplified overview, all four full-detail landmark selections (Westview, plaza, Mesa Verde, Deer Canyon), Escape return, browser Back, Park Village-first regional loading and subsequent Torrey Pines with ocean crests. A local read-only request-logging proxy confirms exactly one request for each GLB: overview first, original only upon Torrey Highlands, region only upon Park Village, with no new regional request at Torrey Pines. Map coverage/framing also passes at390×844; the avatar tile becomes blank under the automated phone resize and returns after restoring desktop size, so this is map-only responsive evidence and not a claim that the full phone UI is verified. Avatar source was unchanged. Captured application error/warning logs are empty.

The reviewed desktop screenshot is `/tmp/yuyang-optimization-qa/optimized-overview.png`. Temporary benchmark/proxy servers are agent-owned; they are stopped at completion. The user's existing development server remains available.

Final browser checks also confirm San Diego departure to the globe, New York entry, and Washington Square with its arch/fountain/Bobst/landmark details rendered, with no captured warning/error logs. The viewport override is reset; all agent-created QA tabs and both QA servers are closed. Final whitespace checks pass.
