import { Injectable, InternalServerErrorException } from "@nestjs/common";
import { tavily } from "@tavily/core";

@Injectable()
export class TavilyService {
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
