import { Injectable } from "@nestjs/common";
import { PineconeService, PineconeMatch } from "./pinecone.service";

/**
 * ContextService
 * --------------
 * Orchestrates the full retrieval-augmentation step:
 *   1. Takes raw similarity-search matches from Pinecone
 *   2. Expands each match by fetching its immediate neighbors (±window)
 *   3. Deduplicates all chunks by ID
 *   4. Re-sorts by original relevance score (descending)
 *   5. Concatenates into a formatted context block ready to inject into the prompt
 *
 * The resulting string is wrapped in XML-style tags so the LLM can clearly
 * distinguish retrieved facts from the system prompt and conversation history.
 */
@Injectable()
export class ContextService {
  constructor(private readonly pinecone: PineconeService) {}

  /**
   * Build a context string from a set of Pinecone similarity matches.
   *
   * @param matches     Results returned by PineconeService.queryIndex()
   * @param window      Number of neighboring chunks to fetch on each side (default: 1)
   * @param maxChars    Hard cap on total context characters (default: 2000)
   * @returns           Formatted context block, or empty string if no matches
   */
  async buildContext(
    matches:  PineconeMatch[],
    window    = parseInt(process.env.PINECONE_NEIGHBORS ?? "1", 10),
    maxChars  = parseInt(process.env.MCP_MAX_CONTEXT     ?? "2000", 10),
  ): Promise<string> {
    if (matches.length === 0) return "";

    // ── 1. Collect neighbor IDs to fetch ────────────────────────────────────
    const neighborIds: string[] = [];

    for (const match of matches) {
      const { docId, chunkIndex } = match.metadata;

      // Generate IDs for chunks immediately before and after this match
      for (let delta = -window; delta <= window; delta++) {
        if (delta === 0) continue;  // skip the match itself — already have it
        const neighborIndex = chunkIndex + delta;
        if (neighborIndex >= 0) {
          neighborIds.push(`${docId}-chunk-${neighborIndex}`);
        }
      }
    }

    // ── 2. Fetch neighbors (ignore missing IDs — Pinecone returns only found ones)
    let neighbors: PineconeMatch[] = [];
    try {
      neighbors = await this.pinecone.fetchChunksByIds([...new Set(neighborIds)]);
    } catch {
      // Neighbor expansion is best-effort — continue with just the direct matches
      neighbors = [];
    }

    // ── 3. Merge and deduplicate by chunk ID ────────────────────────────────
    const seen   = new Set<string>();
    const merged: PineconeMatch[] = [];

    for (const chunk of [...matches, ...neighbors]) {
      if (!seen.has(chunk.id)) {
        seen.add(chunk.id);
        merged.push(chunk);
      }
    }

    // ── 4. Sort: direct matches (score > 0) first, then neighbors by docId/chunkIndex
    merged.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      // Within same document, preserve reading order
      if (a.metadata.docId === b.metadata.docId) {
        return a.metadata.chunkIndex - b.metadata.chunkIndex;
      }
      return 0;
    });

    // ── 5. Concatenate text up to maxChars ──────────────────────────────────
    let combined = "";
    for (const chunk of merged) {
      const candidate = combined
        ? `${combined}\n\n${chunk.metadata.text}`
        : chunk.metadata.text;

      if (candidate.length > maxChars) break;
      combined = candidate;
    }

    if (!combined) return "";

    // Wrap in clear delimiters so the LLM treats this as reference material
    return `[CONTEXT]\n${combined.trim()}\n[/CONTEXT]`;
  }
}
