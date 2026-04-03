import { Injectable, InternalServerErrorException } from "@nestjs/common";
import { tavily } from "@tavily/core";

/**
 * TavilyService
 * -------------
 * Thin wrapper around the Tavily web search API.
 * Returns a formatted text block suitable for injection into the
 * TogetherAI conversation as a system message — mirrors the pattern
 * used by executeRetrieve() in ChatService.
 */
@Injectable()
export class TavilyService {
  /**
   * search
   * ------
   * Run a web search via Tavily and return a formatted context block.
   * Each result includes its title, URL, and a content snippet.
   *
   * @param query  Natural-language search query
   * @param maxResults  Number of results to return (default 5)
   */
  async search(query: string, maxResults = 5): Promise<string> {
    const apiKey = process.env.TAVILY_API_KEY;
    if (!apiKey) {
      throw new InternalServerErrorException("TAVILY_API_KEY not configured");
    }

    console.log("[Tavily] Searching:", query);

    const client = tavily({ apiKey });
    const response = await client.search(query, {
      maxResults,
      searchDepth: "basic",
    });

    if (!response.results || response.results.length === 0) {
      return "Web search results:\n\nNo relevant results found. Respond based on what you already know, or say you don't know.";
    }

    // Format each result as a numbered block with title, URL, and snippet
    const formatted = response.results
      .map((r, i) => {
        const title   = r.title ?? "Untitled";
        const url     = r.url ?? "";
        const content = r.content ?? "";
        return `${i + 1}. ${title}\n   ${url}\n   ${content}`;
      })
      .join("\n\n");

    console.log(`[Tavily] Got ${response.results.length} results`);

    return `Web search results for "${query}":\n\n${formatted}\n\nUse these results to inform your response. Cite sources when relevant.`;
  }
}
