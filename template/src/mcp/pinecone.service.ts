import { Injectable } from "@nestjs/common";
import { Pinecone, RecordMetadata } from "@pinecone-database/pinecone";

export interface ChunkMetadata extends RecordMetadata {
  text:       string;
  chunkIndex: number;
  docId:      string;
  source:     string;
}

export interface PineconeMatch {
  id:         string;
  score:      number;
  metadata:   ChunkMetadata;
}

@Injectable()
export class PineconeService {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private indexHandle: ReturnType<Pinecone["index"]> | null = null;

  private getIndex() {
    if (this.indexHandle) return this.indexHandle;

    const apiKey    = process.env.PINECONE_API_KEY;
    // CUSTOMIZE: Change the default index name to match your Pinecone index
    const indexName = process.env.PINECONE_INDEX ?? "my-knowledge";

    if (!apiKey) {
      throw new Error("PINECONE_API_KEY not configured");
    }

    const client    = new Pinecone({ apiKey });
    this.indexHandle = client.index<ChunkMetadata>(indexName);
    return this.indexHandle;
  }

  async queryIndex(embedding: number[], topK = 5): Promise<PineconeMatch[]> {
    const index = this.getIndex();

    const result = await index.query({
      vector:          embedding,
      topK,
      includeMetadata: true,
      includeValues:   false,
    });

    return (result.matches ?? [])
      .filter((m) => m.metadata !== undefined)
      .map((m) => ({
        id:       m.id,
        score:    m.score ?? 0,
        metadata: m.metadata as ChunkMetadata,
      }));
  }

  async fetchChunksByIds(ids: string[]): Promise<PineconeMatch[]> {
    if (ids.length === 0) return [];

    const index  = this.getIndex();
    const result = await index.fetch({ ids });

    return Object.values(result.records ?? {})
      .filter((r) => r.metadata !== undefined)
      .map((r) => ({
        id:       r.id,
        score:    0,
        metadata: r.metadata as ChunkMetadata,
      }));
  }
}
