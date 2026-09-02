import type { ResponseInputItem, ResponseOutputItem } from "openai/resources/responses/responses";
import { readFileSync } from "node:fs";
import { formatRetrievedContext, getOpenAIClient, retrieveContext } from "../memory/retrieval";
import { AGENT_TOOLS, parseAgentCommand, parseMemorySearch, resolveHyperlink, searchWeb } from "./tools";
import type { AgentCommand, AgentMessage, AgentStreamEvent, MapDestination } from "../contracts/types";
import { CAMERA_VIEWS } from "../context/camera-views";

const INSTRUCTIONS = readFileSync(new URL("../context/base-prompt.md", import.meta.url), "utf8").trim();

function recentConversationContext(messages: AgentMessage[]) {
  return messages.slice(-6).map((message) => `${message.role}: ${message.content}`).join("\n").slice(-6_000);
}

function explicitlyRequestsApprovedLink(messages: AgentMessage[]) {
  const question = [...messages].reverse().find((message) => message.role === "user")?.content ?? "";
  if (/\b(github|linkedin|instagram)\b/i.test(question)) return true;
  const asksForLink = /\b(link|url|website|web site|profile|account|follow)\b/i.test(question);
  return asksForLink && /\b(tech\s*@?\s*nyu|bac|business analytics club|shift)\b/i.test(question);
}

export function extractFinalAnswerText(output: ResponseOutputItem[]) {
  return output.flatMap((item) => {
    if (item.type !== "message" || item.role !== "assistant" || item.phase === "commentary") return [];
    return item.content.flatMap((part) => part.type === "output_text" ? [part.text] : []);
  }).join("");
}

export async function* streamAgent(messages: AgentMessage[], currentView: MapDestination): AsyncGenerator<AgentStreamEvent> {
  const latestUserMessage = [...messages].reverse().find((message) => message.role === "user")?.content;
  if (!latestUserMessage) throw new Error("A user message is required.");
  const requestLogId = crypto.randomUUID();
  const currentTurnDateTime = new Date().toISOString();
  const input: ResponseInputItem[] = [
    { role: "developer", content: `Current turn date and time (UTC): ${currentTurnDateTime}\nCurrent camera view: ${currentView}\nAvailable camera views (live registry):\n${CAMERA_VIEWS.map((view) => `- ${view.id}: ${view.label}`).join("\n")}` },
    ...messages.map((message) => ({ role: message.role, content: message.content } as ResponseInputItem)),
  ];
  const commands = new Map<string, AgentCommand>();
  const openai = getOpenAIClient();
  const model = process.env.OPENAI_AGENT_MODEL ?? "gpt-5.4-mini";
  let previousResponseId: string | undefined;
  let roundInput = input;
  const forceHyperlinkFirst = explicitlyRequestsApprovedLink(messages);

  yield { type: "status", status: "thinking" };
  for (let round = 0; round < 10; round += 1) {
    const stream = openai.responses.stream({
      model, instructions: INSTRUCTIONS, input: roundInput, previous_response_id: previousResponseId,
      tools: AGENT_TOOLS,
      tool_choice: round === 0 && forceHyperlinkFirst ? { type: "function", name: "hyperlink" } : "auto",
      parallel_tool_calls: true,
    });
    for await (const _event of stream) {
      // The browser receives text only after the completed response has been
      // classified by message phase below. Streaming every output-text delta can
      // expose intermediate commentary when a model writes tool arguments as text.
    }
    const response = await stream.finalResponse();
    console.info("[Agent][LLM turn]", JSON.stringify({
      requestId: requestLogId,
      round,
      model,
      responseId: response.id,
      userInput: latestUserMessage,
      llmOutput: response.output,
    }));
    const calls = response.output.filter((item) => item.type === "function_call");
    if (calls.length === 0) {
      const completedText = extractFinalAnswerText(response.output);
      if (completedText.trim()) yield { type: "speech_start" };
      if (completedText) yield { type: "text_delta", delta: completedText };
      yield { type: "done" };
      return;
    }

    const outputs: ResponseInputItem[] = [];
    const hasPrivateServerTool = calls.some((call) => call.name === "search_personal_memory" || call.name === "web_search");
    for (const call of calls) {
      if (call.name === "search_personal_memory") {
        yield { type: "status", status: "remembering" };
        const search = parseMemorySearch(call.arguments);
        const chunks = await retrieveContext({ ...search, recentContext: recentConversationContext(messages) });
        outputs.push({ type: "function_call_output", call_id: call.call_id, output: formatRetrievedContext(chunks) });
      } else if (call.name === "hyperlink") {
        const link = resolveHyperlink(call.arguments);
        outputs.push({ type: "function_call_output", call_id: call.call_id, output: JSON.stringify(link) });
      } else if (call.name === "web_search") {
        yield { type: "status", status: "researching" };
        const result = await searchWeb(call.arguments);
        outputs.push({ type: "function_call_output", call_id: call.call_id, output: result });
      } else {
        const command = parseAgentCommand(call.name, call.arguments);
        if (!commands.has(JSON.stringify(command))) commands.set(JSON.stringify(command), command);
        outputs.push({ type: "function_call_output", call_id: call.call_id, output: JSON.stringify({ queued: true, command }) });
      }
    }
    for (const command of commands.values()) yield { type: "command", command };
    commands.clear();
    previousResponseId = response.id;
    roundInput = outputs;
    if (hasPrivateServerTool) yield { type: "status", status: "thinking" };
  }
  throw new Error("The agent exceeded the tool-call round limit.");
}
