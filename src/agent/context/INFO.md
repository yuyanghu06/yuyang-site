# Agent context

This folder contains human-editable context and configuration used by the portfolio agent.

## Direct subfolders

There are no direct subfolders.

## Direct files

- `INFO.md` documents this folder.
- `base-prompt.md` is the authoritative base agent prompt, including Yuyang Hu's identity, natural answer-composition rules that prevent fact-dump responses, ten session-grounded conversational cadence examples, quick facts, memory policy, and UI-tool behavior. Caption length is a renderer concern rather than a model-writing instruction.
- `camera-views.json` is the data-only registry of geographic and landmark camera configurations, including the broad San Diego overview, Torrey Highlands, Torrey Pines, Park Village, Westview High School, and Torrey Highlands Plaza. The two building cameras retain their authored values and belong to Torrey Highlands.
- `camera-views.ts` imports the JSON camera registry and exposes geographic/landmark IDs, neighborhood ownership, geographic parent and city helpers, and lookup helpers shared by the map, navigation validation, and audio.
- `links.json` is the approved key-to-URL registry used by the server-side hyperlink tool.
