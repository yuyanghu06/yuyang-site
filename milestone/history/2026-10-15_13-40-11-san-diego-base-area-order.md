# San Diego base-area order

Acting role: primary agent, direct implementation per user preference.

Request: base tour order should be Torrey Highlands → Park Village → Torrey Pines.

Changed `src/components/dialogue/tour-stops.ts` circular ordering and next/previous links so the Plaza leads to Park Village, Park Village leads to Torrey Pines, and Torrey Pines wraps to Highlands. Retained Deer Canyon → Mesa Verde → Westview → Plaza within Highlands. Reordered the three overview chooser buttons in `src/components/agent-chat.tsx` to match. Updated component/dialogue/San Diego folder guides and milestone state/index. Preserved concurrent conversation/image work and all prior changes.

Verification: targeted ESLint passes. Temporary actual-source routing harness verifies exact full and base-area order, every next/previous link, all 1,024 current/visited-set cases, complete tours from seven starting points, continuation when places remain, visited skipping and fresh-tour reset. Scoped whitespace passes. No production build or browser visual review ran for the data/menu-order change.

Result: complete, uncommitted and ready for review. No publication performed.
