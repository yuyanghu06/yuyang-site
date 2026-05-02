/**
 * scripts/ingest.ts
 * -----------------
 * Offline pipeline that:
 *   1. Reads all *.md and *.txt files from the knowledge/ directory
 *   2. Splits each file into overlapping chunks
 *   3. Embeds every chunk via the OpenAI embeddings endpoint
 *   4. Upserts the resulting vectors + metadata into a Pinecone index
 *
 * Usage:
 *   npx ts-node --project tsconfig.scripts.json scripts/ingest.ts
 *
 * Required env vars:
 *   OPENAI_API_KEY, OPENAI_EMBEDDING_MODEL, PINECONE_API_KEY, PINECONE_INDEX
 */

import * as fs   from "fs";
import * as path from "path";
import * as dotenv from "dotenv";
import { Pinecone } from "@pinecone-database/pinecone";

dotenv.config();

const CHUNK_SIZE    = 1200;
const CHUNK_OVERLAP = 200;
const UPSERT_BATCH  = 100;

function chunkDocument(text: string): string[] {
  const chunks: string[] = [];
  let   start  = 0;

  while (start < text.length) {
    const end   = Math.min(start + CHUNK_SIZE, text.length);
    const chunk = text.slice(start, end).trim();

    if (chunk.length > 0) chunks.push(chunk);

    start += CHUNK_SIZE - CHUNK_OVERLAP;
  }

  return chunks;
}

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

async function main(): Promise<void> {
  const model     = process.env.OPENAI_EMBEDDING_MODEL ?? "text-embedding-3-small";
  const openaiKey = process.env.OPENAI_API_KEY;
  const pineconeKey  = process.env.PINECONE_API_KEY;
  // CUSTOMIZE: Change the default index name to match your Pinecone index
  const indexName    = process.env.PINECONE_INDEX ?? "my-knowledge";

  if (!openaiKey) throw new Error("OPENAI_API_KEY is not set");
  if (!pineconeKey) throw new Error("PINECONE_API_KEY is not set");

  const pinecone = new Pinecone({ apiKey: pineconeKey });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const index    = pinecone.index<any>(indexName);

  console.log(`\n📌  Connected to Pinecone index: "${indexName}"`);
  console.log(`🤖  Using embedding model: ${model}\n`);

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

  let totalChunks = 0;

  for (const file of files) {
    const docId  = path.basename(file, path.extname(file));
    const source = file;
    const text   = fs.readFileSync(path.join(knowledgeDir, file), "utf-8");
    const chunks = chunkDocument(text);

    console.log(`📄  ${file}: ${chunks.length} chunk(s)`);

    const batch: Parameters<typeof upsertBatch>[1] = [];

    for (let i = 0; i < chunks.length; i++) {
      const chunkText = chunks[i];
      const id        = `${docId}-chunk-${i}`;

      const values = await embedText(chunkText, openaiKey, model);

      batch.push({
        id,
        values,
        metadata: { text: chunkText, chunkIndex: i, docId, source },
      });

      process.stdout.write(`  ↳ chunk ${i + 1}/${chunks.length} embedded\r`);

      if (batch.length >= UPSERT_BATCH) {
        await upsertBatch(index, batch.splice(0, batch.length));
      }
    }

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
