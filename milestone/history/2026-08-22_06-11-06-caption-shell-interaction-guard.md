# Caption shell interaction guard

The docked avatar shell now rejects both pointer-drag initialization and fullscreen-open clicks whenever the originating target is within `.agent-chat`. This shell-level contract covers all current and future Reply variants, inputs, pills, and caption controls even if an individual child lacks its own propagation guard.

The compact Cancel text was also reduced to `0.66rem` and 500 weight after visual review.

Verification completed with targeted ESLint for `src/components/avatar-call.tsx` and `src/components/agent-chat.tsx`, plus `npx tsc --noEmit`. A full production build was intentionally not run because no commit was requested.
