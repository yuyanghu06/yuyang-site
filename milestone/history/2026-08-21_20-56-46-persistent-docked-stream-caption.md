# Persistent docked stream caption

- Both scripted character streams and live server response streams now report their lifecycle to the call shell.
- Any stream while minimized automatically reveals the latest caption; minimizing during an active stream does the same.
- The docked caption is aligned by its right edge beside the avatar and persists after completion.
- A small ×, any outside pointer interaction, or expanding the call dismisses it. Re-minimizing does not restore the dismissed completed caption.
- Targeted ESLint, `npx tsc --noEmit`, and `git diff --check` pass.
