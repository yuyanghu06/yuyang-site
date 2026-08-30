# Agent API route

This folder exposes the server-only portfolio guide endpoint. It rate-limits requests, validates bounded multi-turn conversation input, and runs the OpenAI agent loop without exposing credentials, citations, retrieval metadata, or the private Pinecone memory-search tool to the browser. Base facts bypass retrieval; other personal questions must invoke the private tool before the agent may answer. Its NDJSON stream exposes only safe `thinking` and `remembering` presentation states, answer text, and validated UI commands.

## Direct subfolders

There are no direct subfolders.

## Direct files

- `INFO.md` documents this folder.
- `route.ts` imports the reorganized runtime and shared contracts, then implements the newline-delimited streaming `POST /api/agent` response.
