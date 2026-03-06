import { Injectable } from "@nestjs/common";
import { Pinecone, RecordMetadata } from "@pinecone-database/pinecone";

/**
 * Shape of metadata stored alongside each vector in Pinecone.
 * Every chunk upserted by scripts/ingest.ts must conform to this shape.
 */
export interface ChunkMetadata extends RecordMetadata {
  text:       string;  // raw text content of this chunk
  chunkIndex: number;  // position of this chunk within its source document
  docId:      string;  // identifier for the parent document (e.g. "bio")
  source:     string;  // human-readable label shown in logs
}

/** One match returned by Pinecone similarity search */
export interface PineconeMatch {
  id:         string;
  score:      number;
  metadata:   ChunkMetadata;
}

/**
 * PineconeService
 * ---------------
 * Thin wrapper around the Pinecone SDK that exposes two operations:
 *   1. queryIndex  — similarity search given a query embedding vector
 *   2. fetchChunksByIds — bulk-fetch specific vectors by ID (used for
 *      neighbor-chunk expansion after a similarity search)
 *
 * The Pinecone client is lazily initialised on first use so the service
 * can be instantiated even when env vars are absent (graceful degradation).
 */
@Injectable()
export class PineconeService {
  // Lazily created Pinecone index handle — null until first use
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private indexHandle: ReturnType<Pinecone["index"]> | null = null;

  /** Initialise and cache the Pinecone index handle */
  private getIndex() {
    if (this.indexHandle) return this.indexHandle;

    const apiKey    = process.env.PINECONE_API_KEY;
    const indexName = process.env.PINECONE_INDEX ?? "yuyang-knowledge";

    if (!apiKey) {
      // Caller is responsible for skipping Pinecone when the key is absent
      throw new Error("PINECONE_API_KEY not configured");
    }

    // Pinecone v3+ only requires the API key — no environment string needed
    const client    = new Pinecone({ apiKey });
    this.indexHandle = client.index<ChunkMetadata>(indexName);
    return this.indexHandle;
  }

  /**
   * Run a top-K similarity search and return matches with their metadata.
   * @param embedding  Query vector produced by EmbeddingService
   * @param topK       Number of nearest neighbours to return (default: 5)
   */
  async queryIndex(embedding: number[], topK = 5): Promise<PineconeMatch[]> {
    const index = this.getIndex();

    const result = await index.query({
      vector:          embedding,
      topK,
      includeMetadata: true,  // we need the text payload
      includeValues:   false,  // raw vectors not needed downstream
    });

    // Filter out any matches that are missing metadata (shouldn't happen, but be safe)
    return (result.matches ?? [])
      .filter((m) => m.metadata !== undefined)
      .map((m) => ({
        id:       m.id,
        score:    m.score ?? 0,
        metadata: m.metadata as ChunkMetadata,
      }));
  }

  /**
   * Fetch specific chunks by their Pinecone record IDs.
   * Used to pull in neighboring chunks (chunkIndex ± window) after a query.
   * Returns only those IDs that actually exist and have metadata.
   */
  async fetchChunksByIds(ids: string[]): Promise<PineconeMatch[]> {
    if (ids.length === 0) return [];

    const index  = this.getIndex();
    const result = await index.fetch({ ids });

    // result.records is a Record<string, { id, values, metadata }>
    return Object.values(result.records ?? {})
      .filter((r) => r.metadata !== undefined)
      .map((r) => ({
        id:       r.id,
        score:    0,  // fetched records have no relevance score
        metadata: r.metadata as ChunkMetadata,
      }));
  }
}
