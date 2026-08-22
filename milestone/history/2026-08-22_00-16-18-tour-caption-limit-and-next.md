# Tour caption limit and Next

Scripted guided-tour captions now use the same strict 170-character segmentation policy as agent output. The 188-character Washington Square narration is split at a natural sentence boundary and stored as a deterministic local queue.

When another scripted segment remains, a blue `Next` button renders below the caption bubble, including in docked presentation. Selecting it streams the next queued scripted message and never sends an improvised continuation request to the agent. The Manhattan destination caption is also dismissed immediately on selection before its arrival-gated neighborhood narration begins.

Verification completed with targeted ESLint for `src/components/agent-chat.tsx` and `npx tsc --noEmit`. A full production build was intentionally not run because no commit was requested.
