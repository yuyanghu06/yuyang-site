# In-bubble pills with Reply

The deterministic tour `Next` moved back inside the latest caption and now uses the same blue choice-pill component and dimensions as the intro `Yes`. In minimized presentation, agent-requested blue `Next` and white `Cancel` pills likewise render inside the latest bubble; expanded presentation retains its existing external controls.

Every in-bubble pill row now keeps Reply visible immediately to its right. Selecting Reply replaces the row with the existing inline composer.

Verification completed with targeted ESLint for `src/components/agent-chat.tsx` and `npx tsc --noEmit`. A full production build was intentionally not run because no commit was requested.
