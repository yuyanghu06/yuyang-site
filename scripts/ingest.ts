/**
 * scripts/ingest.ts
 * -----------------
 * One-time (or periodic) offline pipeline that:
 *   1. Reads all *.md and *.txt files from the knowledge/ directory
 *   2. Splits each file into overlapping chunks (~300 tokens / ~1200 chars each)
 *   3. Embeds every chunk via the TogetherAI embeddings endpoint
 *   4. Upserts the resulting vectors + metadata into a Pinecone index
 *
 * Usage:
 *   npx ts-node --project tsconfig.scripts.json scripts/ingest.ts
 *
 * Required env vars (same as the main app):
 *   TOGETHER_API_KEY, OPENAI_API_KEY, OPENAI_EMBEDDING_MODEL, PINECONE_API_KEY, PINECONE_INDEX
 *
 * The script is idempotent — re-running it overwrites vectors for the same
 * chunk IDs, so you can safely refresh the index after editing knowledge files.
 */

import * as fs   from "fs";
import * as path from "path";
import * as dotenv from "dotenv";
import { Pinecone } from "@pinecone-database/pinecone";

// Load .env so we can run this script outside of NestJS
dotenv.config();

// ─── Configuration ───────────────────────────────────────────────────────────

/** Target character length per chunk (~300 tokens at 4 chars/token) */
const CHUNK_SIZE    = 1200;

/** Overlap in characters between consecutive chunks to preserve context */
const CHUNK_OVERLAP = 200;

/** Number of vectors to upsert in a single Pinecone batch request */
const UPSERT_BATCH  = 100;

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Split a document string into overlapping character-level chunks.
 * Each chunk is at most CHUNK_SIZE characters with CHUNK_OVERLAP of shared text
 * between successive chunks to prevent context loss at boundaries.
 */
function chunkDocument(text: string): string[] {
  const chunks: string[] = [];
  let   start  = 0;

  while (start < text.length) {
    const end   = Math.min(start + CHUNK_SIZE, text.length);
    const chunk = text.slice(start, end).trim();

    if (chunk.length > 0) chunks.push(chunk);

    // Advance by (CHUNK_SIZE - CHUNK_OVERLAP) so successive chunks share context
    start += CHUNK_SIZE - CHUNK_OVERLAP;
  }

  return chunks;
}

/**
 * Call the OpenAI embeddings endpoint for a single string.
 * Returns the raw float vector.
 */
async function embedText(text: string, apiKey: string, model: string): Promise<number[]> {
  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method:  "POST",
    headers: {
      "Content-Type":  "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model, input: text }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`OpenAI Embedding API error: ${err}`);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any = await response.json();
  const vector: number[] = data?.data?.[0]?.embedding;

  if (!vector || vector.length === 0) throw new Error("Empty embedding returned");
  return vector;
}

/**
 * Upsert a batch of Pinecone records.
 * Each record carries the vector, chunk text, and positional metadata.
 */
async function upsertBatch(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  index:   ReturnType<Pinecone["index"]>,
  records: Array<{
    id:     string;
    values: number[];
    metadata: { text: string; chunkIndex: number; docId: string; source: string };
  }>,
): Promise<void> {
  await index.upsert(records);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  // ── Validate environment ─────────────────────────────────────────────────
  const apiKey    = process.env.TOGETHER_API_KEY;
  const model     = process.env.OPENAI_EMBEDDING_MODEL ?? "text-embedding-3-small";
  const openaiKey = process.env.OPENAI_API_KEY;
  const pineconeKey  = process.env.PINECONE_API_KEY;
  const indexName    = process.env.PINECONE_INDEX ?? "yuyang-knowledge";

  if (!apiKey)    throw new Error("TOGETHER_API_KEY is not set");
  if (!openaiKey) throw new Error("OPENAI_API_KEY is not set");
  if (!pineconeKey) throw new Error("PINECONE_API_KEY is not set");

  // ── Connect to Pinecone ──────────────────────────────────────────────────
  const pinecone = new Pinecone({ apiKey: pineconeKey });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const index    = pinecone.index<any>(indexName);

  console.log(`\n📌  Connected to Pinecone index: "${indexName}"`);
  console.log(`🤖  Using embedding model: ${model}\n`);  // ── Discover knowledge files ─────────────────────────────────────────────
  const knowledgeDir = path.join(__dirname, "..", "knowledge");

  if (!fs.existsSync(knowledgeDir)) {
    throw new Error(`knowledge/ directory not found at ${knowledgeDir}`);
  }

  const files = fs.readdirSync(knowledgeDir).filter(
    (f) => f.endsWith(".md") || f.endsWith(".txt"),
  );

  if (files.length === 0) {
    console.warn("⚠️  No .md or .txt files found in knowledge/. Nothing to ingest.");
    return;
  }

  console.log(`📂  Found ${files.length} file(s): ${files.join(", ")}\n`);

  // ── Process each file ────────────────────────────────────────────────────
  let totalChunks = 0;

  for (const file of files) {
    // Derive a stable document ID from the filename (without extension)
    const docId  = path.basename(file, path.extname(file));
    const source = file;
    const text   = fs.readFileSync(path.join(knowledgeDir, file), "utf-8");
    const chunks = chunkDocument(text);

    console.log(`📄  ${file}: ${chunks.length} chunk(s)`);

    // Accumulate upsert records in UPSERT_BATCH-sized batches
    const batch: Parameters<typeof upsertBatch>[1] = [];

    for (let i = 0; i < chunks.length; i++) {
      const chunkText = chunks[i];
      const id        = `${docId}-chunk-${i}`;

      // Embed the chunk via OpenAI — rate-limit by awaiting sequentially
      const values = await embedText(chunkText, openaiKey, model);

      batch.push({
        id,
        values,
        metadata: { text: chunkText, chunkIndex: i, docId, source },
      });

      process.stdout.write(`  ↳ chunk ${i + 1}/${chunks.length} embedded\r`);

      // Flush the batch when it reaches the target size
      if (batch.length >= UPSERT_BATCH) {
        await upsertBatch(index, batch.splice(0, batch.length));
      }
    }

    // Flush any remaining records
    if (batch.length > 0) {
      await upsertBatch(index, batch);
    }

    console.log(`  ✅  ${file} ingested (${chunks.length} chunks)`);
    totalChunks += chunks.length;
  }

  console.log(`\n🎉  Done! Upserted ${totalChunks} total chunk(s) into "${indexName}".`);
}

main().catch((err: Error) => {
  console.error("❌  Ingest failed:", err.message);
  process.exit(1);
});
