# Camera dialogue

This folder owns concise, conversational Markdown dialogue injected into the client-side dialogue renderer. The renderer uses one 120-character soft target on every viewport, prefers a nearby clean boundary, and queues overflow behind a manual blue Next control. Guided-tour Next controls also navigate between authored locations. Inline links use standard `[label](https://example.com/)` Markdown syntax; the renderer preserves them during splitting, streams their readable labels, and opens them safely in a new tab once the caption completes. A camera stream enters a control-free phase before its first character so buttons from the preceding caption cannot carry into the new text.

## Subfolders

- `global/` contains the invitation and globe-level city-choice question for New York and San Diego.
- `new-york/` keeps the Manhattan overview script at its root and groups the Union Square and Washington Square overview/landmark scripts in neighborhood subfolders.
- `san-diego/` keeps the regional overview and tour completion scripts at its root, with one subfolder per individual district or landmark camera. Park Village's waterfall has no separate tour destination.

## Files

- `index.ts` imports and exports every authored overview/landmark Markdown string for the shared renderer. The city and camera hierarchy changes only import paths; authored narration and export names remain unchanged.
- `tour-stops.ts` defines phases and the circular San Diego route: Torrey Highlands → Deer Canyon → Mesa Verde → Westview → plaza → Park Village → Torrey Pines → Torrey Highlands. The regional overview offers three entry areas. `getNextUnvisitedSanDiegoStop` skips visited locations and returns no next stop only after all seven are visited. The shared phase predicate keeps Next/Back/Reply valid for district and school captions; the existing globe choice and previous-stop handling remain available.


- `caption-text.ts` owns the existing 120-character soft-target caption splitting and link protection shared by all tour and agent replies; paragraph boundaries always start another caption, and protected links are restored after segmentation.
- `INFO.md` documents the dialogue folders and direct files.
- `markdown.d.ts` declares Markdown imports as string modules for TypeScript.

- `caption-scroll.ts` computes the existing dialogue-card scroll limits from assistant caption positions and viewport height. Extracted without behavior changes to keep the combined chat component within its established line budget.
