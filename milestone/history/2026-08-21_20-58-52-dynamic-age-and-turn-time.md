# Dynamic age and current-turn time

- The initial greeting derives Yuyang's completed age from October 29, 2006 using the browser's current local date.
- Every accepted agent turn generates a fresh `Date().toISOString()` timestamp immediately before its developer context is assembled.
- The timestamp is labeled as the current turn's UTC date and time and precedes camera state plus retrieved context.
- Targeted ESLint, `npx tsc --noEmit`, and `git diff --check` pass.
