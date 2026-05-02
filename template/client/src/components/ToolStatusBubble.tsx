import type { ToolCall } from "../context/ChatContext";

const TOOL_CLASSES: Record<string, string> = {
  retrieve:   "tool-bubble--retrieve",
  web_search: "tool-bubble--web-search",
  navigate:   "tool-bubble--navigate",
  contact:    "tool-bubble--contact",
  redirect:   "tool-bubble--redirect",
};

export default function ToolStatusBubble({ toolCall }: { toolCall: ToolCall }) {
  const modifier = TOOL_CLASSES[toolCall.tool] ?? "";

  return (
    <div className={`tool-status-bubble ${modifier}`}>
      <span className="tool-bubble-dot" />
      <span className="tool-bubble-text">{toolCall.summary}</span>
    </div>
  );
}
