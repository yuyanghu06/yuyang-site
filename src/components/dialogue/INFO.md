# Camera dialogue

This folder owns concise, conversational Markdown dialogue injected into the client-side dialogue renderer. The renderer uses one 120-character soft target on every viewport, prefers a nearby clean boundary, and queues overflow behind a manual blue Next control. Guided-tour Next controls also navigate between authored locations. Inline links use standard `[label](https://example.com/)` Markdown syntax; the renderer preserves them during splitting, streams their readable labels, and opens them safely in a new tab once the caption completes. A camera stream enters a control-free phase before its first character so buttons from the preceding caption cannot carry into the new text.

## Subfolders

- `global/` contains the invitation and globe-level city-choice question for New York and San Diego.
- `manhattan/` contains only the Manhattan overview dialogue.
- `washington-square/` contains the Washington Square overview and landmark camera dialogue.
- `union-square/` contains the Union Square overview and landmark camera dialogue.
- `san-diego/` contains the regional/district captions, preserved authored Torrey Highlands, Westview and plaza narratives, preserved Mesa Verde/Deer Canyon scripts and main-dev completion. Park Village's waterfall has no separate tour destination.

## Files

- `index.ts` imports and exports every authored overview/landmark Markdown string for the shared renderer. All dialogue files that already existed on main dev remain byte-identical.
- `tour-stops.ts` defines phases and the default route: San Diego region → Torrey Highlands → Westview → plaza → Torrey Pines → Park Village. Mesa Verde and Deer Canyon remain manual selectable school visits with their existing dialogue; they do not change the default route. The shared phase predicate keeps Next/Back/Reply valid for all district and school captions. Main-dev globe choice, previous-stop handling and completion choices are retained.


- `caption-text.ts` owns the existing 120-character soft-target caption splitting and link protection shared by all tour and agent replies; paragraph boundaries always start another caption, and protected links are restored after segmentation.
- `INFO.md` documents the dialogue folders and direct files.
- `markdown.d.ts` declares Markdown imports as string modules for TypeScript.

- `caption-scroll.ts` computes the existing dialogue-card scroll limits from assistant caption positions and viewport height. Extracted without behavior changes to keep the combined chat component within its established line budget.
