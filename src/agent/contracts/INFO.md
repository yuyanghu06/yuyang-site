# Agent contracts

This folder contains types and browser events shared across agent, API, chat, avatar, and map boundaries.

## Direct subfolders

There are no direct subfolders.

## Direct files

- `INFO.md` documents this folder.
- `types.ts` defines agent messages with optional visitor-only image and file data, shared 512 KiB image / 1 MiB file / 2 MiB total decoded attachment limits, combined three-per-message / four-per-request limits, the Thinking/Remembering/Researching stream statuses, map and emote commands, and browser event dispatch helpers.

- `files.ts` provides browser-safe document/text/unsupported classification, strict UTF-8 fallback decoding without NUL bytes, and extension-based MIME normalization for supported document and code attachments. The UI and server use the same classification for honest unavailable-content status.
