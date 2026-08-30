# Agent structure, links, and RAG policy

- Split agent code into context, contracts, memory, and runtime folders with complete folder documentation.
- Moved the base prompt to Markdown and camera entries to an imported JSON registry.
- Consolidated all tool schemas into one JSON file and aligned its memory query types with the runtime validator.
- Added a server-side hyperlink lookup backed by six user-approved URLs in a key/value JSON registry; explicit profile/link requests deterministically force the lookup on the first model round.
- Expanded Shift's base context with growth marketing and the negative-CAC data-collection funnel.
- Added the canonical Google Doc authoring, chunking, metadata, replacement-ingestion, cleanup, and verification contract to `AGENTS.md`.
- Targeted ESLint, TypeScript, JSON-shape checks, and the full Next.js production build pass.
