import { Injectable } from "@nestjs/common";
import { PineconeService, PineconeMatch } from "./pinecone.service";

@Injectable()
export class ContextService {
  constructor(private readonly pinecone: PineconeService) {}

  async buildContext(
    matches:  PineconeMatch[],
    window    = parseInt(process.env.PINECONE_NEIGHBORS ?? "1", 10),
    maxChars  = parseInt(process.env.MCP_MAX_CONTEXT     ?? "2000", 10),
  ): Promise<string> {
    if (matches.length === 0) return "";

    const neighborIds: string[] = [];

    for (const match of matches) {
      const { docId, chunkIndex } = match.metadata;
      for (let delta = -window; delta <= window; delta++) {
        if (delta === 0) continue;
        const neighborIndex = chunkIndex + delta;
        if (neighborIndex >= 0) {
          neighborIds.push(`${docId}-chunk-${neighborIndex}`);
        }
      }
    }

    let neighbors: PineconeMatch[] = [];
    try {
      neighbors = await this.pinecone.fetchChunksByIds([...new Set(neighborIds)]);
    } catch {
      neighbors = [];
    }

    const seen   = new Set<string>();
    const merged: PineconeMatch[] = [];

    for (const chunk of [...matches, ...neighbors]) {
      if (!seen.has(chunk.id)) {
        seen.add(chunk.id);
        merged.push(chunk);
      }
    }

    merged.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (a.metadata.docId === b.metadata.docId) {
        return a.metadata.chunkIndex - b.metadata.chunkIndex;
      }
      return 0;
    });

    let combined = "";
    for (const chunk of merged) {
      const candidate = combined
        ? `${combined}\n\n${chunk.metadata.text}`
        : chunk.metadata.text;

      if (candidate.length > maxChars) break;
      combined = candidate;
    }

    if (!combined) return "";

    return `[CONTEXT]\n${combined.trim()}\n[/CONTEXT]`;
  }
}
