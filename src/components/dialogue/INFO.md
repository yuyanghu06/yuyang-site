# Camera dialogue

This folder owns concise, conversational Markdown dialogue injected into the client-side dialogue renderer. The renderer uses one 120-character soft target on every viewport, prefers a nearby clean boundary, and queues overflow behind a manual blue Next control. Guided-tour Next controls also navigate between authored locations. Inline links use standard `[label](https://example.com/)` Markdown syntax; the renderer preserves them during splitting, streams their readable labels, and opens them safely in a new tab once the caption completes. A camera stream enters a control-free phase before its first character so buttons from the preceding caption cannot carry into the new text.

## Subfolders

- `global/` contains dialogue that belongs to the overall experience rather than one geographic view.
- `manhattan/` contains only the Manhattan overview dialogue.
- `washington-square/` contains the Washington Square overview and landmark camera dialogue.
- `union-square/` contains the Union Square overview and landmark camera dialogue.

## Files

- `index.ts` imports and exports every overview and landmark Markdown dialogue string consumed by `agent-chat.tsx`, including both clickable Union Square buildings.
- `markdown.d.ts` declares Markdown imports as string modules for TypeScript.
