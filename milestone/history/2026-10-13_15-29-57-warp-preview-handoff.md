# Warp preview handoff

- Scope: investigate the reported npm `EPERM` / `uv_cwd` startup failure.
- Evidence: original folder exists, is user-owned, and remains on `dev`; fresh Node resolves its working directory and npm reports its version successfully.
- Action: stopped only the agent-owned Next.js preview to release port 3000. No app code or permission changes.
- Handoff: reset Warp with `cd /`, change into the absolute original backend path, then start `npm run dev`. Warp’s interactive-shell result still needs user verification.
