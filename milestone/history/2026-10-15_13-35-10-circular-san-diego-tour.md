# Circular San Diego tour completion

Acting role: primary agent, implementing directly at the user's request.

Request: show the final hometown/New York/Globe dialogue only after all San Diego locations are visited; otherwise Next must loop to the next unvisited location in tour order, including from an arbitrary starting area.

Changed `src/components/dialogue/tour-stops.ts`: defined a circular order over all seven authored San Diego district/landmark locations and a pure helper that skips visited stops and returns null only when none remain. Mesa Verde/Deer Canyon are included in the required route. Updated next/previous metadata for the school sequence and Park Village wrap.

Changed `src/components/agent-chat.tsx`: track actual settled San Diego visits, including backward/manual arrival and same-view selection, in a per-tour Set. Next records the current stop defensively, chooses the next unvisited stop, and streams completion only when the route is exhausted. Progress persists across city changes and clears when accepting a new tour invitation. Existing segmented-caption Next behavior is retained.

Updated component/dialogue/San Diego folder documentation, current milestone, milestone folder guide and history index. Preserved concurrent composer edits, dialogue restructuring/copy and earlier fade/button work.

Verification: targeted ESLint and full TypeScript without incremental output pass. The temporary `/tmp/yuyang-tour-check/check.cjs` loads/transpiles the actual registry and actual chat arrival/Next handlers. It passes all 1,024 visited-subset/current-position combinations, complete tours from each of seven starting points, early Park Village wrap to Torrey Highlands, skipping visited Westview and fresh-tour reset. Route metadata is checked against the full circular sequence. Scoped whitespace checks pass. No browser visual review or production build was run.

Result: implemented, uncommitted and ready for review. No commit/publication performed. Browser visual review remains a verification limitation.
