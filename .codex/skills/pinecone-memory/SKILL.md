---
name: pinecone-memory
description: Author, rebuild, replace, and verify this repository's personal-memory knowledge base. Use when asked to add, revise, remove, or ingest facts in Pinecone or the site's RAG memory. Do not use for ordinary Pinecone application code, retrieval debugging, or unrelated vector databases.
---

# Pinecone Memory

Treat the canonical Google Doc as the only authoring surface and Pinecone as a replaceable derived index. Never add, patch, or delete individual Pinecone vectors independently of the Doc.

## Workflow

1. Read `milestone/current.md`, `AGENTS.md`, and the current memory scripts before acting. Preserve unrelated worktree changes.
2. Use the repository's Google Drive and Google Docs skills to locate and edit the canonical document. Before the first write, follow the Docs trusted-read workflow and confirm the document ID, title, revision, tab, target record, and live indexes.
3. Update the existing Heading 3 entity when one exists. Create a new Heading 3 only for a genuinely distinct entity or independently retrievable subject.
4. Use Heading 2 for the retrieval domain, Heading 3 for the canonical record, and optional Heading 4 subsections for separate topics. Start records with applicable metadata lines: `Entity type:`, `Entity ID:`, `Aliases:`, and `Record status:`. Keep stable lowercase entity IDs and self-contained factual prose.
5. Verify the Google Doc edit by connector readback before exporting it.
6. Export the complete current Doc paragraph structure to `/tmp/yuyang-pinecone-memory/memory-source.json`. The JSON must contain `documentId`, `documentUrl`, `revisionId`, and `paragraphs`; each paragraph contains `style` and `text`. Do not check the export or corpus into the repository.
7. Build the corpus:

   ```sh
   npm run memory:build -- --source /tmp/yuyang-pinecone-memory/memory-source.json --output /tmp/yuyang-pinecone-memory/memory-corpus.json
   ```

8. Inspect record and chunk counts, stable IDs, contextual prefixes, required metadata, and representative changed chunks before any Pinecone write. Required metadata is `text`, `source`, `domain`, `record`, `entityId`, `entityType`, `aliases`, `searchTerms`, `status`, `section`, `chunkIndex`, `chunkCount`, and `sourceRevisionId`.
9. Resolve `PINECONE_INDEX` and `PINECONE_NAMESPACE` from the live environment. Print and verify their concrete values. Never guess a destructive target.
10. Replacement ingestion is destructive and requires the user's request to authorize the memory update. Run only with both exact confirmations:

   ```sh
   npm run memory:ingest -- --corpus /tmp/yuyang-pinecone-memory/memory-corpus.json --reset --confirm-index "$PINECONE_INDEX" --confirm-namespace "${PINECONE_NAMESPACE:-__default__}"
   ```

11. Require the final namespace vector count to equal the corpus chunk count. Then test an exact-name/entity query, a semantic paraphrase, a multi-turn follow-up, an authoritative base fact that must bypass RAG, and an unsupported question that must return uncertainty. Confirm visitor-facing answers expose no citations, scores, metadata, entity IDs, or retrieval internals.
12. Remove `/tmp/yuyang-pinecone-memory/` and any trusted-read staging after successful ingestion and verification.
13. Update the relevant `INFO.md` files, `milestone/current.md`, and add one timestamped append-only handoff in `milestone/history/` for the completed memory change.

## Safety and stopping conditions

- Use `text-embedding-3-small` with the deployed 1536-dimension index.
- Do not continue to ingestion if the Google Doc readback, export metadata, corpus inspection, concrete target resolution, or destructive confirmations are missing.
- Do not claim success if the namespace count differs from the generated chunk count or the changed fact cannot be retrieved.
- If ingestion fails after the reset begins, keep the generated corpus temporarily for recovery, report the incomplete state, and do not clean up evidence needed to restore the namespace.
