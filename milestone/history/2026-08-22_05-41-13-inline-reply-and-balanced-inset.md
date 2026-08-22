# Inline Reply and balanced inset

In-bubble Reply controls now stop pointer-down and click propagation before opening the inline composer, preventing the minimized avatar shell from interpreting the same interaction as a fullscreen-open request.

The expanded caption layer's top boundary inset was reduced from five rem to two rem, matching its existing two-rem bottom inset. The left inset remains five rem.

Verification completed with targeted ESLint for `src/components/agent-chat.tsx` and `npx tsc --noEmit`. A full production build was intentionally not run because no commit was requested.
