# San Diego runtime optimization

Role: orchestrator recording scoped runtime coder pass.

The new scene-resources helper caches static local matrices and geometry bounds, sharing exact root geometry for SD glows. Four merged landmark roots stay dynamic. Avoids 1,533,258 duplicated buffer bytes. The loader verifies four unique roots and cleans failed/aborted decode. Partial mounting rolls back population, markers, registry and picking roots for clean retry; lazy imports after teardown avoid decoding.

SD frames skip hidden NYC landmark/arrival/ambient/traveler work; globe marker opacity runs only on globe frames. SD independently caches its light shadow: initialization, mounting, entry and actual caster lift/grounding invalidate it, while hidden NYC asynchronous tile loads cannot. Landmark animation retains default NYC invalidation. SD shadow targets are disposed. Deferred city audio starts preparing with the first city import.

Changed SD loader/new helper/guide, persistent runtime/guide, and landmark animation/guide. No generated geometry, camera, quality or audio-level changes. Final eight-mesh actual-function harness passes geometry/bounds, four dynamic roots, shared disposal once, hidden-work resume, shadow gates/target disposal, missing roots, late abort, partial mounting and retry. Targeted ESLint, full no-incremental TypeScript and scoped whitespace pass. Independent evaluator reran these checks and reports no actionable findings.
