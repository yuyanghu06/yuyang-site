# Torrey Highlands school tour order

Acting role: primary agent, direct implementation per user preference.

Request: Torrey Highlands tour should visit Deer Canyon → Mesa Verde → Westview (“West U”) → Plaza.

Updated `src/components/dialogue/tour-stops.ts` route order and next/previous metadata. Full route is Torrey Highlands → Deer Canyon → Mesa Verde → Westview → Plaza → Torrey Pines → Park Village → Torrey Highlands. Existing next-unvisited logic and all-visited completion gate remain intact. Updated component, dialogue and San Diego folder guides plus current milestone, milestone guide and history index. Preserved concurrent conversation/image work and earlier edits.

Checks: targeted ESLint passes. Temporary actual-source harness confirms the exact requested route and every forward/back link; all 1,024 position/visited-subset cases, seven full starting-point tours, early Park Village wrap, visited-stop skipping and fresh-tour reset pass. Scoped whitespace checks pass. No production build or browser visual review ran for this route-data adjustment.

Result: complete, uncommitted and ready for review. No publication performed.
