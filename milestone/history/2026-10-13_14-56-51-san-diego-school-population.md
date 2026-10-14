# San Diego school-focused people and ordinary cars

Role: orchestrator integrating separate planning, coding, independent evaluation, and live visual verification.

Requested scope: after Mesa Verde/Deer Canyon detailing, populate San Diego with the New York people/car assets, concentrate activity at schools, keep neighborhoods sparse, exclude taxis, and use a separate car-spawn script. All work is in `backend-dev`; the original `backend` checkout remains clean.

Implemented distribution:

| Zone | People | Cars |
| --- | ---: | ---: |
| Westview | 60 | 16 |
| Mesa Verde | 45 | 12 |
| Deer Canyon | 40 | 12 |
| Torrey Highlands Plaza | 15 | 6 |
| Neighborhoods | 36 | 24 |
| Total | 196 | 70 |

The NYC instanced body/head and chassis/cabin factories are shared without changing NYC geometry, clothing, colors, reveal or animation defaults; the original New York taxi ordering remains exact. San Diego supplies independent frozen layouts and an explicit ordinary-car palette. Dedicated car and pedestrian generators use final geographic/source/model provenance, whole movement envelopes, mapped school/plaza parcels, road widths/shoulders, building/tree/detail clearance and bridge/approach exclusions. Per-person ground heights are sampled from the final decoded GLB; flat-road car support is y0.5. Campus orbits exclude raised walks/shoulders; neighborhood orbits fit mapped paths.

Population imports stay behind lazy San Diego loading. Four instanced meshes mount once on successful load, reveal on first visible entry, stay outside landmark picking, skip hidden-city updates, and use fixed full-motion culling bounds. Scene cleanup emits InstancedMesh.dispose() to release GPU instance buffers. Stale model hashes reject population layouts that need regeneration. New York visibility guards skip its hidden street-life updates.

Files: new `scripts/map-data/build-san-diego-car-spawns.mjs`, `build-san-diego-people-spawns.mjs`, `san-diego-spawn-utils.mjs`; generated `src/generated/san-diego-car-spawns.ts` and `san-diego-people-spawns.ts`; shared street-life factory and NYC wrappers/loading guards; San Diego population/car-spawn/loader; runtime mounting/disposal; package commands and containing folder guides. School generator/model/source outputs remain finalized from the preceding detail pass. Unrelated concurrent map expansion, selectable-school navigation, and agent model changes are preserved.

Commands: `npm run data:san-diego:population` regenerates both layouts after geographic/model changes; `data:san-diego:cars` and `data:san-diego:people` also run independently. Rebuild the final scene before population.

Verification: fresh targeted ESLint, TypeScript without incremental output, syntax and whitespace checks pass. Independent full collision audits check 19,110 pedestrian pairs and 2,415 car pairs with zero conflicts. Final decoded-ground checks cover 41,622 conservative envelope samples and 180,390 rotating-body/route samples with no steps above 5 cm (painted road stripe accounts for the maximum). Four instanced meshes and 557,760 sampled transformed vertices fit full culling bounds. Hidden frames leave matrices unchanged. Exact NYC default matrices/colors/geometry match at multiple animation times. Cleanup emits four instance, geometry and material disposal events. Provenance matches the finalized model, source and layout. Initial culling, ground-support and instance-disposal review findings were corrected and independently rechecked; final evaluator reports no findings.

Two final regenerations are byte-identical. Generated file SHA256: people `4cde80aeb0ed234807cb96f226b9735a348129286167c8a267180d778ea20835`, cars `b4191024a5c048fc2f0b0249c08c11943bd7d35fc4b8e6d04b953428e950d435`. The unchanged school model is `eca6e8141563ba184bd4f45c5e5712a1ac0af367f181eb2774cf6ead134e295d`, 7,506,908 bytes, eight meshes/four merged roots.

Chrome live review verifies SD overview/re-entry, visible concentrated populations, direct Mesa/Deer marker selection, attached complete school details, and both school camera fits at desktop and 390×844. No application errors appeared in captured browser logs. Screenshots are temporary review artifacts under `/tmp/yuyang-{mesa-verde,deer-canyon}-detail-population{,-phone}.png`. Viewport override was reset. Isolated before/after oblique/facade previews also confirm the detailed architecture. Physical touch/Safari was not exercised; existing placeholder stories remain separate follow-up work. No production build, commit, push or deployment was requested or performed.

Result: requested detailing and school-focused population are complete locally. Next steps remain user-directed visual tuning, physical-device review and supplied school stories; regenerate population whenever future scene geometry changes.
