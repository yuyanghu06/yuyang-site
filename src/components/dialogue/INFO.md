# Camera dialogue

This folder owns Markdown-authored dialogue injected into the client-side dialogue renderer. The renderer converts each imported script into natural-boundary caption segments capped at 170 characters and exposes streamed Next controls for overflow in both guided and direct camera visits. A camera stream enters a control-free phase before its first character so buttons from the preceding caption cannot carry into the new text.

## Subfolders

- `global/` contains dialogue that belongs to the overall experience rather than one geographic view.
- `manhattan/` contains dialogue for Manhattan and its currently scripted neighborhood and landmark camera views.
- `union-square/` is reserved for dialogue attached to Union Square camera views.

## Files

- `index.ts` imports and exports the Markdown dialogue strings consumed by `agent-chat.tsx`.
- `markdown.d.ts` declares Markdown imports as string modules for TypeScript.
