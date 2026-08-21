# Map module refactor and repository guides

- Replaced the 3,507-line `src/components/map.tsx` implementation with a stable three-line entry point and a shared parent orchestrator.
- Split globe, Manhattan navigation, waterfront, ambient life, parks, landmarks, shared types/constants, and rendering into owned modules; neighborhood behavior is nested beneath Manhattan.
- Added an ESLint `max-lines` error capped at 1,600 authored lines, excluding deterministic generated source.
- Added `info.md` guides throughout meaningful repository directories based on `AGENTS.md` and actual project ownership.
- Removed the empty `src/app/union-square` directory; Union Square remains a camera state inside the persistent map.
- Verified with `npx tsc --noEmit --pretty false` and `npx eslint . --max-warnings=0`; the full production build was not run because no commit was requested.
