import type { FunctionTool } from "openai/resources/responses/responses";
import agentTools from "./agent_tools.json";
import links from "../context/links.json";
import { MEMORY_QUERY_TYPES, type MemoryQueryType, type MemorySearchInput } from "../memory/retrieval";
import { AVATAR_EMOTES, MAP_DESTINATIONS, type AgentCommand, type AvatarEmote, type MapDestination } from "../contracts/types";

export const AGENT_TOOLS = agentTools as FunctionTool[];
export type HyperlinkKey = keyof typeof links;

type TavilySearchResult = {
  title?: unknown;
  url?: unknown;
  content?: unknown;
  score?: unknown;
};

type TavilySearchResponse = {
  answer?: unknown;
  results?: unknown;
};

function hasString(value: unknown, key: string): value is Record<string, string> {
  return typeof value === "object" && value !== null && typeof (value as Record<string, unknown>)[key] === "string";
}

function hasOnlyKeys(value: unknown, allowed: readonly string[]) {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    && Object.keys(value).every((key) => allowed.includes(key))
    && Object.keys(value).length === allowed.length;
}

export function parseAgentCommand(name: string, rawArguments: string): AgentCommand {
  let argumentsValue: unknown;
  try {
    argumentsValue = JSON.parse(rawArguments);
  } catch {
    throw new Error(`Tool ${name} supplied invalid JSON.`);
  }
  if (name === "navigate_map" && hasOnlyKeys(argumentsValue, ["destination"]) && hasString(argumentsValue, "destination")
    && MAP_DESTINATIONS.includes(argumentsValue.destination as MapDestination)) {
    return { type: "navigate_map", destination: argumentsValue.destination as MapDestination };
  }
  if (name === "trigger_avatar_emote" && hasOnlyKeys(argumentsValue, ["emote"]) && hasString(argumentsValue, "emote")
    && AVATAR_EMOTES.includes(argumentsValue.emote as AvatarEmote)) {
    return { type: "trigger_avatar_emote", emote: argumentsValue.emote as AvatarEmote };
  }
  throw new Error(`Tool ${name} supplied unsupported arguments.`);
}

export function parseMemorySearch(rawArguments: string): MemorySearchInput {
  let value: unknown;
  try { value = JSON.parse(rawArguments); } catch { throw new Error("search_personal_memory supplied invalid JSON."); }
  if (!hasOnlyKeys(value, ["query", "queryType", "entities"])) throw new Error("search_personal_memory supplied unsupported arguments.");
  const candidate = value as Record<string, unknown>;
  if (typeof candidate.query !== "string" || !candidate.query.trim()) throw new Error("search_personal_memory requires a query.");
  if (typeof candidate.queryType !== "string" || !MEMORY_QUERY_TYPES.includes(candidate.queryType as MemoryQueryType)) throw new Error("search_personal_memory requires a supported query type.");
  if (!Array.isArray(candidate.entities) || !candidate.entities.every((entity) => typeof entity === "string")) throw new Error("search_personal_memory requires string entities.");
  return { query: candidate.query.trim(), queryType: candidate.queryType as MemoryQueryType, entities: candidate.entities.map((entity) => entity.trim()).filter(Boolean).slice(0, 12) };
}

export function resolveHyperlink(rawArguments: string): { key: HyperlinkKey; url: string } {
  let value: unknown;
  try { value = JSON.parse(rawArguments); } catch { throw new Error("hyperlink supplied invalid JSON."); }
  if (!hasOnlyKeys(value, ["key"]) || typeof (value as Record<string, unknown>).key !== "string") {
    throw new Error("hyperlink requires a link key.");
  }
  const key = (value as { key: string }).key;
  if (!Object.prototype.hasOwnProperty.call(links, key)) throw new Error("hyperlink supplied an unsupported link key.");
  return { key: key as HyperlinkKey, url: links[key as HyperlinkKey] };
}

export function parseWebSearch(rawArguments: string): string {
  let value: unknown;
  try { value = JSON.parse(rawArguments); } catch { throw new Error("web_search supplied invalid JSON."); }
  if (!hasOnlyKeys(value, ["query"]) || typeof (value as Record<string, unknown>).query !== "string") {
    throw new Error("web_search requires a query.");
  }
  const query = (value as { query: string }).query.trim();
  if (!query || query.length > 500) throw new Error("web_search requires a query between 1 and 500 characters.");
  return query;
}

export async function searchWeb(rawArguments: string): Promise<string> {
  const query = parseWebSearch(rawArguments);
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) throw new Error("TAVILY_API_KEY is not configured.");

  const response = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query,
      search_depth: "basic",
      max_results: 5,
      include_answer: "basic",
      include_raw_content: false,
    }),
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) throw new Error(`Tavily search failed with HTTP ${response.status}.`);

  const payload = await response.json() as TavilySearchResponse;
  const results = Array.isArray(payload.results) ? payload.results as TavilySearchResult[] : [];
  return JSON.stringify({
    query,
    answer: typeof payload.answer === "string" ? payload.answer.slice(0, 2_000) : null,
    results: results.slice(0, 5).map((result) => ({
      title: typeof result.title === "string" ? result.title.slice(0, 300) : "",
      url: typeof result.url === "string" ? result.url : "",
      content: typeof result.content === "string" ? result.content.slice(0, 1_500) : "",
      score: typeof result.score === "number" ? result.score : null,
    })),
  });
}
