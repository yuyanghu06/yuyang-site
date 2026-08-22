# Preserve minimized neighborhood choice

The Manhattan `Union Square` and `Washington Square` controls now stop both pointer-down and click propagation at their button row. This prevents the same interaction from reaching the minimized avatar tile's fullscreen-open handler. A choice that starts minimized therefore remains minimized while navigation begins; an expanded choice still minimizes explicitly before navigation.

Verification completed with targeted ESLint for `src/components/agent-chat.tsx` and `npx tsc --noEmit`. A full production build was intentionally not run because no commit was requested.
