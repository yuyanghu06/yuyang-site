import type { ToolCall } from "../context/ChatContext";

/**
 * ToolStatusBubble
 * ----------------
 * Renders a compact status indicator for a tool call in the chat stream.
 * Appears above the assistant message it's associated with.
 * Uses the site's muted styling — feels like metadata, not primary content.
 */

// Map tool names to CSS class modifiers for the pulsing dot color
const TOOL_CLASSES: Record<string, string> = {
  retrieve: "tool-bubble--retrieve",
  navigate: "tool-bubble--navigate",
  contact:  "tool-bubble--contact",
  redirect: "tool-bubble--redirect",
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
