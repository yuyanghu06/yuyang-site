import { Pinecone, type RecordMetadata } from "@pinecone-database/pinecone";
import OpenAI from "openai";
import type { RagCitation } from "../contracts/types";

export const MEMORY_QUERY_TYPES = ["identity", "person", "organization", "project", "work", "event", "place", "interest", "goal", "general"] as const;
export type MemoryQueryType = (typeof MEMORY_QUERY_TYPES)[number];
export type MemorySearchInput = { query: string; queryType: MemoryQueryType; entities: string[]; recentContext?: string };

type MemoryMetadata = RecordMetadata & {
  text: string; source: string; domain: string; record: string; entityId: string; entityType: string;
  aliases: string[]; searchTerms: string[]; status: string; chunkIndex: number; chunkCount: number;
};
type RetrievedChunk = RagCitation & { text: string; domain: string; record: string; entityId: string; retrieval: string[] };

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

const stopWords = new Set(["about", "after", "again", "also", "and", "are", "because", "been", "before", "being", "between", "but", "does", "from", "have", "into", "just", "more", "most", "other", "that", "the", "their", "them", "then", "there", "these", "they", "this", "through", "what", "when", "where", "which", "who", "with", "would", "yuyang"]);

function tokenize(value: string) {
  return [...new Set(value.toLowerCase().normalize("NFKD").replace(/[^a-z0-9\s-]/g, " ").split(/[\s-]+/).filter((token) => token.length > 1 && !stopWords.has(token)))];
}

function queryTypeDomain(queryType: MemoryQueryType) {
  const domains: Partial<Record<MemoryQueryType, string>> = {
    identity: "Identity", person: "People", organization: "Organizations and roles", project: "Projects",
    work: "Organizations and roles", event: "Life events", place: "Places", interest: "Interests", goal: "Goals and plans",
  };
  return domains[queryType];
}

function normalizeMetadata(metadata: RecordMetadata | undefined): MemoryMetadata | null {
  if (typeof metadata?.text !== "string" || !metadata.text.trim()) return null;
  const stringValue = (key: string) => typeof metadata[key] === "string" ? metadata[key] as string : "";
  const numericValue = (key: string, fallback: number) => typeof metadata[key] === "number" ? metadata[key] as number : fallback;
  const stringArray = (key: string) => Array.isArray(metadata[key]) ? metadata[key].filter((value): value is string => typeof value === "string") : [];
  return {
    text: metadata.text.trim(), source: stringValue("source"), domain: stringValue("domain"), record: stringValue("record"),
    entityId: stringValue("entityId"), entityType: stringValue("entityType"), aliases: stringArray("aliases"),
    searchTerms: stringArray("searchTerms"), status: stringValue("status"),
    chunkIndex: numericValue("chunkIndex", 0), chunkCount: numericValue("chunkCount", 1),
  };
}

export async function retrieveContext(input: MemorySearchInput): Promise<RetrievedChunk[]> {
  const standaloneQuery = input.query.trim();
  if (!standaloneQuery) throw new Error("Memory search query is required.");
  const semanticQuery = input.recentContext?.trim() ? `${standaloneQuery}\nRecent conversation context: ${input.recentContext.trim()}` : standaloneQuery;
  const embedding = await getOpenAIClient().embeddings.create({ model: "text-embedding-3-small", input: semanticQuery, encoding_format: "float" });
  const vector = embedding.data[0]?.embedding;
  if (!vector) throw new Error("OpenAI returned no query embedding.");

  const configuredTopK = Number.parseInt(process.env.PINECONE_TOP_K ?? "8", 10);
  const outputLimit = Number.isFinite(configuredTopK) ? Math.min(Math.max(configuredTopK, 1), 12) : 8;
  const candidateLimit = Math.max(outputLimit * 4, 24);
  const index = getPineconeClient().index<MemoryMetadata>(requireEnvironment("PINECONE_INDEX"));
  const namespace = process.env.PINECONE_NAMESPACE;
  const domain = queryTypeDomain(input.queryType);
  const lexicalTerms = tokenize(`${standaloneQuery} ${input.entities.join(" ")}`).slice(0, 12);
  const common = { vector, includeMetadata: true, ...(namespace ? { namespace } : {}) };
  const [broad, filtered, lexical] = await Promise.all([
    index.query({ ...common, topK: candidateLimit }),
    domain ? index.query({ ...common, topK: Math.max(outputLimit * 2, 12), filter: { domain: { $eq: domain } } }) : Promise.resolve({ matches: [] }),
    lexicalTerms.length ? index.query({ ...common, topK: candidateLimit, filter: { searchTerms: { $in: lexicalTerms } } }) : Promise.resolve({ matches: [] }),
  ]);

  const fused = new Map<string, { score: number; metadata: MemoryMetadata; retrieval: Set<string> }>();
  const add = (id: string, rank: number, weight: number, method: string, metadata?: RecordMetadata) => {
    const normalized = normalizeMetadata(metadata);
    if (!normalized) return;
    const current = fused.get(id) ?? { score: 0, metadata: normalized, retrieval: new Set<string>() };
    current.score += weight / (60 + rank);
    current.retrieval.add(method);
    fused.set(id, current);
  };
  broad.matches.forEach((match, rank) => add(match.id, rank + 1, 1, "dense", match.metadata));
  filtered.matches.forEach((match, rank) => add(match.id, rank + 1, 0.85, "dense-filtered", match.metadata));
  lexical.matches.forEach((match, rank) => add(match.id, rank + 1, 1.15, "lexical-filtered", match.metadata));

  const entityNeedles = tokenize(input.entities.join(" "));
  for (const candidate of fused.values()) {
    const haystack = tokenize(`${candidate.metadata.record} ${candidate.metadata.aliases.join(" ")} ${candidate.metadata.entityId}`);
    if (entityNeedles.length && entityNeedles.every((token) => haystack.includes(token))) candidate.score += 0.025;
    if (domain && candidate.metadata.domain === domain) candidate.score += 0.008;
  }

  return [...fused.entries()].sort((a, b) => b[1].score - a[1].score).slice(0, outputLimit).map(([id, candidate]) => ({
    id, source: candidate.metadata.source, score: candidate.score, text: candidate.metadata.text,
    domain: candidate.metadata.domain, record: candidate.metadata.record, entityId: candidate.metadata.entityId,
    retrieval: [...candidate.retrieval],
  }));
}

export function formatRetrievedContext(chunks: RetrievedChunk[]) {
  if (chunks.length === 0) return "No matching personal knowledge was found.";
  return chunks.map((chunk) => `<memory_evidence>\n${chunk.text}\n</memory_evidence>`).join("\n\n");
}
