# Camera dialogue

This folder owns concise, conversational Markdown dialogue injected into the client-side dialogue renderer. The renderer uses one 120-character soft target on every viewport, prefers a nearby clean boundary, and queues overflow behind a manual blue Next control. Guided-tour Next controls also navigate between authored locations. Inline links use standard `[label](https://example.com/)` Markdown syntax; the renderer preserves them during splitting, streams their readable labels, and opens them safely in a new tab once the caption completes. A camera stream enters a control-free phase before its first character so buttons from the preceding caption cannot carry into the new text.

## Subfolders

- `global/` contains the invitation and globe-level city-choice question for New York and San Diego.
- `manhattan/` contains only the Manhattan overview dialogue.
- `washington-square/` contains the Washington Square overview and landmark camera dialogue.
- `union-square/` contains the Union Square overview and landmark camera dialogue.
- `san-diego/` contains authored Torrey Highlands neighborhood, Westview High School, and plaza narratives, plus provisional Mesa Verde, Deer Canyon, and route-completion dialogue. Westview links its East Asian Student Union account, and the plaza links Chef Beric episodes.

## Files

- `index.ts` imports and exports the globe city-choice question and every overview and landmark Markdown dialogue string consumed by `agent-chat.tsx`, including the New York stops and Torrey Highlands neighborhood overview → Westview → plaza → Mesa Verde → Deer Canyon route.
- `tour-stops.ts` defines typed dialogue phases, including globe arrival/city choice, the San Diego stop sequence, shared New York landmark captions, and the previous-stop lookup used by Back. San Diego's terminal Back action returns directly to the preceding camera stop even after multiple captions; guided overview Back returns to the globe city choice. New York retains its existing caption-history behavior. Each authored stop uses the same renderer; freeform Reply still exits the scripted route.
- `caption-text.ts` owns the existing 120-character soft-target caption splitting and link protection shared by all tour and agent replies; paragraph boundaries always start another caption, and protected links are restored after segmentation.
- `INFO.md` documents the dialogue folders and direct files.
- `markdown.d.ts` declares Markdown imports as string modules for TypeScript.
