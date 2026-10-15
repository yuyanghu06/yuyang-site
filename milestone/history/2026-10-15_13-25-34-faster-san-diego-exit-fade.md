# Faster San Diego exit fade

Acting role: primary agent, working directly at the user's request.

Requested scope: fade the San Diego zoom-out view sooner so cropped map edges are hidden during departure.

Starting state: existing edits in `next-env.d.ts` and three San Diego dialogue files. These remain untouched.

Changed `src/components/map/runtime/map-runtime.tsx` only in the outbound San Diego opacity branch: smoothstep now spans transition progress 0–0.18 instead of 0.12–0.45. With the existing 2,168 ms duration, coverage starts immediately and reaches full opacity at approximately 390 ms instead of 976 ms. Pullback and globe handoff timing remain intact.

Updated runtime folder documentation, `milestone/current.md`, `milestone/INFO.md`, and the history index.

Verification: targeted ESLint passes; direct diff review confirms the other opacity branches and camera behavior are unchanged; diff whitespace checks pass. No browser visual review or production build was run for this timing-only change.

Result: ready for user review, uncommitted. No publication performed. Further visual tuning can follow user feedback.
