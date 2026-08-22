# Manhattan neighborhood buttons

The completed Manhattan welcome caption now replaces its ordinary Reply action with two white liquid-glass choices: `Union Square` and `Washington Square`. The choices are nested inside the latest caption so they remain visible next to the minimized avatar; ordinary history and unrelated controls remain hidden in docked mode.

Selecting either choice clears the one-shot Manhattan choice phase and dispatches the matching `navigate_map` command through the existing authored camera path.

Verification completed with targeted ESLint for `src/components/agent-chat.tsx` and `npx tsc --noEmit`. A full production build was intentionally not run because no commit was requested.
