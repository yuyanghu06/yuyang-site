# Project Agent Instructions

## Session startup

- At the start of every new session, read `milestone/current.md` if it exists before beginning work.
- Use timestamped files in `milestone/history/` when historical context is needed; do not read the entire history by default.

## Milestone maintenance

- After meaningful project work, update `milestone/current.md` with the authoritative project state, decisions, blockers, and next steps.
- After meaningful project work, also create a concise session handoff in `milestone/history/` using the filename format `YYYY-MM-DD_HH-MM-SS-short-description.md`.
- Treat files in `milestone/history/` as append-only records. Do not revise an existing history file to reflect later work.
- Do not create a history entry for a session that made no meaningful project change.

## Figma workflow

- The project uses the Figma MCP server for design work.
- When the user provides a Figma project, place all generated style-reference images in that Figma file.
- Organize each distinct website page or concept area on its own Figma page.
- For generated reference sets, use a clearly named Figma page and preserve useful variant names or captions.
- Do not leave generated style references only in local or temporary storage once a target Figma file has been provided.
- If the supplied Figma URL does not contain a real file key or the MCP account lacks access, ask the user for a shareable `/design/<file-key>/...` URL or access before proceeding.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
