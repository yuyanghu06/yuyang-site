import { Pinecone, type RecordMetadata } from "@pinecone-database/pinecone";
import OpenAI from "openai";
import type { RagCitation } from "./types";

type RetrievedChunk = RagCitation & { text: string };
let openaiClient: OpenAI | undefined;
let pineconeClient: Pinecone | undefined;

function requireEnvironment(name: "OPENAI_API_KEY" | "PINECONE_API_KEY" | "PINECONE_INDEX") {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not configured.`);
  return value;
}

export function getOpenAIClient() {
  openaiClient ??= new OpenAI({ apiKey: requireEnvironment("OPENAI_API_KEY") });
  return openaiClient;
}

function getPineconeClient() {
  pineconeClient ??= new Pinecone({ apiKey: requireEnvironment("PINECONE_API_KEY") });
  return pineconeClient;
}

export async function retrieveContext(query: string): Promise<RetrievedChunk[]> {
  const embedding = await getOpenAIClient().embeddings.create({
    model: "text-embedding-3-small",
    input: query,
    encoding_format: "float",
  });
  const vector = embedding.data[0]?.embedding;
  if (!vector) throw new Error("OpenAI returned no query embedding.");
  const configuredTopK = Number.parseInt(process.env.PINECONE_TOP_K ?? "6", 10);
  const topK = Number.isFinite(configuredTopK) ? Math.min(Math.max(configuredTopK, 1), 12) : 6;
  const index = getPineconeClient().index<RecordMetadata>(requireEnvironment("PINECONE_INDEX"));
  const result = await index.query({ vector, topK, includeMetadata: true });

  return result.matches.flatMap((match) => {
    const text = match.metadata?.text;
    if (typeof text !== "string" || !text.trim()) return [];
    const source = typeof match.metadata?.source === "string" ? match.metadata.source : match.id;
    return [{ id: match.id, source, score: match.score ?? 0, text: text.trim() }];
  });
}

export function formatRetrievedContext(chunks: RetrievedChunk[]) {
  if (chunks.length === 0) return "No matching personal knowledge was found.";
  return chunks.map((chunk, index) => `[${index + 1}] Source: ${chunk.source}\n${chunk.text}`).join("\n\n");
}
