import { readFile } from "node:fs/promises";
import path from "node:path";
import { Pinecone } from "@pinecone-database/pinecone";
import OpenAI from "openai";

const args = new Set(process.argv.slice(2));
const valueAfter = (flag) => {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : undefined;
};
const corpusPath = valueAfter("--corpus") || path.join("/tmp/yuyang-pinecone-memory", "memory-corpus.json");
const corpus = JSON.parse(await readFile(corpusPath, "utf8"));
const required = (name) => {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not configured.`);
  return value;
};

const indexName = required("PINECONE_INDEX");
const namespace = process.env.PINECONE_NAMESPACE || "__default__";
if (!args.has("--reset")) throw new Error("Refusing to ingest without --reset; this pipeline replaces the target namespace.");
if (valueAfter("--confirm-index") !== indexName) throw new Error(`Pass --confirm-index ${indexName} to confirm the destructive target.`);
if (valueAfter("--confirm-namespace") !== namespace) throw new Error(`Pass --confirm-namespace ${namespace} to confirm the destructive target.`);
if (!corpus.chunks.length) throw new Error("Memory corpus contains no chunks.");

const pinecone = new Pinecone({ apiKey: required("PINECONE_API_KEY") });
const openai = new OpenAI({ apiKey: required("OPENAI_API_KEY") });
const index = pinecone.index(indexName);
const statsBefore = await index.describeIndexStats();
if (statsBefore.dimension !== 1536) throw new Error(`Index dimension ${statsBefore.dimension} does not match text-embedding-3-small (1536).`);
console.log(JSON.stringify({ phase: "validated", index: indexName, namespace, recordsBefore: statsBefore.namespaces?.[namespace]?.recordCount ?? 0, replacementChunks: corpus.chunks.length }));

if (namespace === "__default__") await index.deleteAll();
else await index.deleteAll({ namespace });
console.log(JSON.stringify({ phase: "cleared", index: indexName, namespace }));

const vectors = [];
for (let start = 0; start < corpus.chunks.length; start += 64) {
  const batch = corpus.chunks.slice(start, start + 64);
  const response = await openai.embeddings.create({ model: corpus.embeddingModel, input: batch.map((chunk) => chunk.text), encoding_format: "float" });
  batch.forEach((chunk, offset) => {
    const values = response.data[offset]?.embedding;
    if (!values) throw new Error(`Missing embedding for ${chunk.id}.`);
    vectors.push({
      id: chunk.id,
      values,
      metadata: {
        text: chunk.text, source: chunk.source, domain: chunk.domain, record: chunk.record,
        entityId: chunk.entityId, entityType: chunk.entityType, aliases: chunk.aliases,
        searchTerms: chunk.searchTerms,
        status: chunk.status, section: chunk.section, chunkIndex: chunk.chunkIndex,
        chunkCount: chunk.chunkCount, sourceRevisionId: chunk.sourceRevisionId,
      },
    });
  });
  console.log(JSON.stringify({ phase: "embedded", completed: Math.min(start + batch.length, corpus.chunks.length), total: corpus.chunks.length }));
}

for (let start = 0; start < vectors.length; start += 100) {
  const batch = vectors.slice(start, start + 100);
  await index.upsert({ records: batch, ...(namespace === "__default__" ? {} : { namespace }) });
  console.log(JSON.stringify({ phase: "upserted", completed: Math.min(start + batch.length, vectors.length), total: vectors.length }));
}

let finalCount = 0;
for (let attempt = 0; attempt < 20; attempt += 1) {
  const stats = await index.describeIndexStats();
  finalCount = stats.namespaces?.[namespace]?.recordCount ?? 0;
  if (finalCount === vectors.length) break;
  await new Promise((resolve) => setTimeout(resolve, 1_500));
}
if (finalCount !== vectors.length) throw new Error(`Pinecone reported ${finalCount} records after ingest; expected ${vectors.length}.`);
console.log(JSON.stringify({ phase: "complete", index: indexName, namespace, records: finalCount, sourceRevisionId: corpus.sourceRevisionId }));
