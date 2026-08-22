# Agent API route

This folder exposes the server-only portfolio guide endpoint. It rate-limits requests, validates bounded conversation input, runs mandatory Pinecone retrieval, and then invokes the OpenAI agent loop without exposing credentials to the browser.

## Direct subfolders

There are no direct subfolders.

## Direct files

- `INFO.md` documents this folder.
- `route.ts` implements the newline-delimited streaming `POST /api/agent` response.
