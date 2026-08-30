# Agent infrastructure

This folder owns the portfolio agent's context, shared contracts, private memory retrieval, live web-search integration, and server-side runtime.

## Direct subfolders

- `context/` contains editable prompt and camera-registry data plus its typed accessors.
- `contracts/` contains types shared between the server agent, API route, map, avatar, and chat UI.
- `memory/` contains the private Pinecone retrieval pipeline.
- `runtime/` contains the OpenAI orchestration loop, the unified tool-schema collection, tool-argument validation, and Tavily-backed public web search.

## Direct files

- `INFO.md` documents this folder.
