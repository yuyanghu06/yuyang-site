# Memory ingestion scripts

This folder owns deterministic transformation and ingestion of the canonical Google Docs memory export used by the site agent.

## Direct subfolders

There are no direct subfolders.

## Direct files

- `INFO.md` documents this folder.
- `build-memory-corpus.mjs` converts a temporary heading-aware Google Doc export into stable contextual chunks enriched with lexical search terms and the canonical source revision; neither source nor corpus is stored in the repository.
- `ingest-memory.mjs` reads the temporary corpus, requires explicit index and namespace confirmations, clears only that validated namespace, embeds and upserts the chunks to Pinecone, and verifies the final record count.
