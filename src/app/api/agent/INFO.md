# Agent API route

This folder exposes the server-only portfolio guide endpoint. It rate-limits requests, validates bounded multi-turn text, image and file input, and runs the OpenAI agent loop without exposing credentials, citations, retrieval metadata, or the private Pinecone memory-search tool to the browser. Base facts bypass retrieval; other personal questions must invoke the private tool before the agent may answer. Its NDJSON stream exposes only safe `thinking` and `remembering` presentation states, answer text, and validated UI commands.

## Direct subfolders

There are no direct subfolders.

## Direct files

- `INFO.md` documents this folder.
- `route.ts` rate-limits and validates requests, then implements the newline-delimited streaming `POST /api/agent` response. Upstream failures use a generic payload-free server log and browser error.
- `request.ts` reads at most 3 MiB before JSON parsing, counting streamed bytes and cancelling oversized bodies even without Content-Length. It preserves text/message/view limits and accepts visitor-only attachments with canonical base64, bounded names, JPEG/PNG/WebP image signatures and PDF file signatures. Limits are 512 KiB per image, 1 MiB per file, 2 MiB total decoded attachments, three combined attachments per message and four per request. Image-only and file-only visitor messages are valid; remote URLs and file IDs are rejected. File data can use arbitrary MIME or an empty MIME; known document extensions receive a normalized MIME in the runtime.
