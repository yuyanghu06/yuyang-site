# Camera dialogue

This folder owns Markdown-authored dialogue injected into the client-side dialogue renderer. The renderer converts each imported script into natural-boundary caption segments capped at 170 characters and exposes streamed Next controls for overflow in both guided and direct camera visits. Inline links use standard `[label](https://example.com/)` Markdown syntax; the renderer preserves them during caption splitting, streams only their readable labels, and opens them safely in a new tab once the caption completes. A camera stream enters a control-free phase before its first character so buttons from the preceding caption cannot carry into the new text.

## Subfolders

- `global/` contains dialogue that belongs to the overall experience rather than one geographic view.
- `manhattan/` contains only the Manhattan overview dialogue.
- `washington-square/` contains the Washington Square overview and landmark camera dialogue.
- `union-square/` contains the Union Square overview and landmark dialogue placeholders.

## Files

- `index.ts` imports and exports the Markdown dialogue strings consumed by `agent-chat.tsx`.
- `markdown.d.ts` declares Markdown imports as string modules for TypeScript.
