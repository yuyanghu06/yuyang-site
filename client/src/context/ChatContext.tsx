import { createContext, useContext, useState, useEffect, useCallback, ReactNode, Dispatch, SetStateAction } from "react";
import type { NavigateFunction } from "react-router-dom";
import { buildAction, executeAction, actionLabel, type AgentAction } from "../lib/chatActions";

// ── Tool call metadata ────────────────────────────────────────────────────────
export interface ToolCall {
  id:        string;   // unique key for React rendering
  tool:      string;   // "retrieve" | "navigate" | "contact" | "redirect"
  summary:   string;   // human-readable description
  timestamp: number;
}

// ── Shared message type ───────────────────────────────────────────────────────
export interface ChatMessage {
  role:        "user" | "assistant";
  content:     string;
  // Optional label shown beneath a bubble when the model triggered a navigate/redirect
  actionHint?: string;
  // Tool calls that preceded this assistant message (shown as status bubbles)
  toolCalls?:  ToolCall[];
  // Data URL of an image attached by the user
  imageUrl?:   string;
}

// sessionStorage key — persists across React Router navigation, clears on refresh
const STORAGE_KEY = "chatHistory";

// Initial greeting injected at the top of every new session
export const CHAT_GREETING: ChatMessage = {
  role:    "assistant",
  content: "Hi, I'm the AI version of Yuyang. Ask me anything about my projects, personal life, etc! " +
           "I have access to information about everyone in my life, can help you navigate the site, " +
           "or can redirect you to the links to my various projects, social media, etc.",
};

// ── SSE event types from the backend ──────────────────────────────────────────
interface SSETokenEvent {
  type:    "token";
  content: string;
}

interface SSEToolCallEvent {
  type:    "tool_call";
  tool:    string;
  summary: string;
}

interface SSEResponseEvent {
  type:    "response";
  content: string;
  action:  { tool: string; parameters: string[] } | null;
}

interface SSEDoneEvent {
  type: "done";
}

interface SSEErrorEvent {
  type: "error";
}

type SSEEvent = SSETokenEvent | SSEToolCallEvent | SSEResponseEvent | SSEDoneEvent | SSEErrorEvent;

// ── Context shape ─────────────────────────────────────────────────────────────
interface ChatContextValue {
  messages:    ChatMessage[];
  setMessages: Dispatch<SetStateAction<ChatMessage[]>>;
  loading:     boolean;
  /**
   * Send a message through the full chat pipeline.
   * @param text     The raw user input to send.
   * @param navigate React Router navigate function from the calling component,
   *                 required to execute [navigate] action tags from the model.
   * @param image    Optional base64 data URL of an image to include.
   */
  sendMessage: (text: string, navigate: NavigateFunction, image?: string) => Promise<void>;
}

const ChatContext = createContext<ChatContextValue | null>(null);

// ── Provider ──────────────────────────────────────────────────────────────────
/**
 * ChatProvider — wraps the app and provides shared chat state + send logic.
 * Restores messages from sessionStorage on mount; writes back on every change.
 * Accessible from any page so the SpotlightButton can chat from any route.
 */
export function ChatProvider({ children }: { children: ReactNode }) {
  // Restore from sessionStorage on first mount; fall back to greeting only.
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      if (saved) {
        return JSON.parse(saved) as ChatMessage[];
      }
      return [CHAT_GREETING];
    } catch {
      return [CHAT_GREETING];
    }
  });

  const [loading, setLoading] = useState(false);

  // Mirror every state change into sessionStorage (survives navigation, not refresh)
  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    } catch { /* silent — chat works, just won't survive navigation */ }
  }, [messages]);

  /**
   * Core send pipeline shared by Home and SpotlightButton.
   * navigate is passed in rather than called via a hook because ChatProvider
   * wraps BrowserRouter — useNavigate() is only available inside the router tree.
   */
  const sendMessage = useCallback(async (text: string, navigate: NavigateFunction, image?: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    // ── AI chat flow (SSE tool-use loop) ────────────────────────────────────
    const userMessage: ChatMessage = { role: "user", content: trimmed, ...(image ? { imageUrl: image } : {}) };
    const nextHistory = [...messages, userMessage];
    setMessages(nextHistory);
    setLoading(true);

    // Accumulate tool calls as they arrive via SSE
    const pendingToolCalls: ToolCall[] = [];
    let   toolCallCounter = 0;

    try {
      const res = await fetch("/api/chat", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: nextHistory.map(({ role, content }) => ({ role, content })),
          ...(image ? { image } : {}),
        }),
      });
      if (!res.ok || !res.body) throw new Error("Stream error");

      const reader  = res.body.getReader();
      const decoder = new TextDecoder();
      let   buffer  = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Process complete SSE lines; keep trailing incomplete line in buffer
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const payload = line.slice(6).trim();

          let event: SSEEvent;
          try { event = JSON.parse(payload); } catch { continue; }

          if (event.type === "token") {
            // Stream token directly into the last assistant message in real-time.
            // If there's no assistant message yet (or the last one is a completed
            // message from a previous turn), create a fresh one for this stream.
            // Clear loading on first token so the loading indicator doesn't overlap.
            setLoading(false);
            setMessages((prev) => {
              const next = [...prev];
              const lastIdx = next.length - 1;
              const last = next[lastIdx];
              if (lastIdx >= 0 && last.role === "assistant" && !last.actionHint) {
                // Append token to the current streaming assistant message
                next[lastIdx] = {
                  ...last,
                  content: (last.content || "") + event.content,
                };
              } else {
                // First token of this response — create a new assistant message
                next.push({ role: "assistant", content: event.content });
              }
              return next;
            });
          } else if (event.type === "tool_call") {
            // Accumulate tool call for display as status bubble
            const toolCall: ToolCall = {
              id:        `tc-${Date.now()}-${toolCallCounter++}`,
              tool:      event.tool,
              summary:   event.summary,
              timestamp: Date.now(),
            };
            pendingToolCalls.push(toolCall);

            // Update the UI — clear any streamed tokens from intermediate iterations
            // and show tool call status bubbles instead
            setMessages((prev) => {
              const next = [...prev];
              const last = next[next.length - 1];
              if (last.role === "assistant" && !last.actionHint) {
                // Replace the streamed content with tool call placeholder
                next[next.length - 1] = { ...last, content: "", toolCalls: [...pendingToolCalls] };
              } else {
                next.push({ role: "assistant", content: "", toolCalls: [...pendingToolCalls] });
              }
              return next;
            });
          } else if (event.type === "response") {
            // Final response — tokens were already streamed live, so just
            // finalize the message with action metadata and tool calls.
            const action = buildAction(event.action ?? null);
            const hintAction =
              action?.type === "navigate" || action?.type === "redirect"
                ? (action as Exclude<AgentAction, { type: "contact" }>)
                : undefined;

            const finalContent = event.content || ".";

            // Finalize the existing streamed assistant message with metadata
            setMessages((prev) => {
              const next = [...prev];
              const lastIdx = next.length - 1;
              const last = next[lastIdx];
              if (last?.role === "assistant" && !last.actionHint) {
                // Update the streamed message with final content + metadata
                next[lastIdx] = {
                  ...last,
                  content:    finalContent,
                  actionHint: hintAction ? actionLabel(hintAction) : undefined,
                  toolCalls:  pendingToolCalls.length > 0 ? [...pendingToolCalls] : undefined,
                };
              } else {
                // Fallback: no streamed message exists, create one
                next.push({
                  role:       "assistant",
                  content:    finalContent,
                  actionHint: hintAction ? actionLabel(hintAction) : undefined,
                  toolCalls:  pendingToolCalls.length > 0 ? [...pendingToolCalls] : undefined,
                });
              }
              return next;
            });

            setLoading(false);

            if (action) {
              executeAction(action, navigate);
            }
          } else if (event.type === "done") {
            // SSE stream complete — loading was already cleared when response arrived.
            // This is a safety net in case the response event was never received.
            setLoading(false);
          } else if (event.type === "error") {
            setMessages((prev) => [...prev, { role: "assistant", content: "Sorry, something went wrong. Please try again." }]);
          }
        }
      }
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: "Sorry, something went wrong. Please try again." }]);
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, loading]);

  return (
    <ChatContext.Provider value={{ messages, setMessages, loading, sendMessage }}>
      {children}
    </ChatContext.Provider>
  );
}

// ── Consumer hook ─────────────────────────────────────────────────────────────
/** Returns shared chat state + send logic. Must be inside <ChatProvider>. */
export function useChatContext(): ChatContextValue {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error("useChatContext must be used inside <ChatProvider>");
  return ctx;
}
