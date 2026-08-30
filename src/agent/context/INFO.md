# Agent context

This folder contains human-editable context and configuration used by the portfolio agent.

## Direct subfolders

There are no direct subfolders.

## Direct files

- `INFO.md` documents this folder.
- `base-prompt.md` is the authoritative base agent prompt, including Yuyang Hu's identity, natural answer-composition rules that prevent fact-dump responses, ten session-grounded conversational cadence examples, quick facts, memory policy, and UI-tool behavior. Caption length is a renderer concern rather than a model-writing instruction.
- `camera-views.json` is the data-only registry of geographic and landmark camera configurations.
- `camera-views.ts` imports the JSON camera registry and exposes its typed IDs and lookup helpers.
- `links.json` is the approved key-to-URL registry used by the server-side hyperlink tool.
