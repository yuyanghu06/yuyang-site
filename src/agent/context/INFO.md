# Agent context

This folder contains human-editable context and configuration used by the portfolio agent.

## Direct subfolders

There are no direct subfolders.

## Direct files

- `INFO.md` documents this folder.
- `base-prompt.md` is the authoritative base agent prompt, including Yuyang Hu's identity, natural answer-composition rules that prevent fact-dump responses, ten session-grounded conversational cadence examples, quick facts, memory policy, and UI-tool behavior. Caption length is a renderer concern rather than a model-writing instruction.
- `camera-views.json` defines the broad San Diego overview, all three districts and four Torrey Highlands landmark cameras alongside the existing New York/globe registry. All four school/plaza camera values stay unchanged, and their parent is Torrey Highlands.
- `camera-views.ts` provides IDs, registry lookups and parent/city classification shared by navigation, picking, rendering and audio. All four Torrey Highlands landmarks classify as San Diego views.
- `links.json` is the approved key-to-URL registry used by the server-side hyperlink tool.
