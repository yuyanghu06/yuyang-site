# Dialogue chunk Reply control

- Acting role: primary implementation agent
- Requested scope: keep Reply visible for every automatically rendered dialogue chunk.
- Starting state: the shared presentation branch rendered Reply only when the terminal action was Done; intermediate segmented chunks exposed Next alone.
- Work performed: made the shared presentation branch render one Reply control for both Next and Done states, and updated the component and milestone documentation to match.
- Changed files: `src/components/agent-chat.tsx`, `src/components/INFO.md`, `milestone/current.md`, `milestone/info.md`, and this handoff plus its history-folder index.
- Decision: retain the existing presentation action and queue behavior; Reply opens the current bubble's composer and a submitted reply still abandons unseen queued chunks.
- Checks/evidence: `npx eslint src/components/agent-chat.tsx`, `npx tsc --noEmit`, `npm run build`, and `git diff --check` all passed.
- Resulting state: intermediate and terminal automatically segmented assistant captions both expose Reply without duplicating the control.
- Remaining work: none identified for this request.
