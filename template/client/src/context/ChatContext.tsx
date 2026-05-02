import { createContext, useContext, useState, useEffect, useCallback, ReactNode, Dispatch, SetStateAction } from "react";
import type { NavigateFunction } from "react-router-dom";
import { buildAction, executeAction, actionLabel, type AgentAction } from "../lib/chatActions";

// ── Tool call metadata ────────────────────────────────────────────────────────
export interface ToolCall {
  id:        string;
  tool:      string;
  summary:   string;
  timestamp: number;
}

// ── Shared message type ───────────────────────────────────────────────────────
export interface ChatMessage {
  role:        "user" | "assistant";
  content:     string;
  actionHint?: string;
  toolCalls?:  ToolCall[];
  imageUrl?:   string;
}

// ── Contact-collection flow ───────────────────────────────────────────────────
export type ContactStep =
  | "idle"
  | "collecting_email"
  | "collecting_message"
  | "sending"
  | "done"
  | "error";

export interface ContactFlow {
  step:    ContactStep;
  email:   string;
  message: string;
}

export const INITIAL_CONTACT_FLOW: ContactFlow = { step: "idle", email: "", message: "" };

const STORAGE_KEY = "chatHistory";

// ── CUSTOMIZE: Change this greeting to introduce your AI assistant ────────────
export const CHAT_GREETING: ChatMessage = {
  role:    "assistant",
  content: "Hi! I'm an AI assistant for this site. Ask me anything about my " +
           "work, projects, or interests. I can also help you navigate the " +
           "site or get in touch.",
};

// ── SSE event types from the backend ──────────────────────────────────────────
interface SSETokenEvent    { type: "token";     content: string; }
interface SSEToolCallEvent { type: "tool_call"; tool: string; summary: string; }
interface SSEResponseEvent { type: "response";  content: string; action: { tool: string; parameters: string[] } | null; }
interface SSEDoneEvent     { type: "done"; }
interface SSEErrorEvent    { type: "error"; }

type SSEEvent = SSETokenEvent | SSEToolCallEvent | SSEResponseEvent | SSEDoneEvent | SSEErrorEvent;

// ── Context shape ─────────────────────────────────────────────────────────────
interface ChatContextValue {
  messages:       ChatMessage[];
  setMessages:    Dispatch<SetStateAction<ChatMessage[]>>;
  loading:        boolean;
  contactFlow:    ContactFlow;
  setContactFlow: Dispatch<SetStateAction<ContactFlow>>;
  sendMessage:    (text: string, navigate: NavigateFunction, image?: string) => Promise<void>;
}

const ChatContext = createContext<ChatContextValue | null>(null);

// ── Provider ──────────────────────────────────────────────────────────────────
export function ChatProvider({ children }: { children: ReactNode }) {
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      if (saved) return JSON.parse(saved) as ChatMessage[];
      return [CHAT_GREETING];
    } catch {
      return [CHAT_GREETING];
    }
  });

  const [loading,     setLoading]     = useState(false);
  const [contactFlow, setContactFlow] = useState<ContactFlow>(INITIAL_CONTACT_FLOW);

  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    } catch { /* silent */ }
  }, [messages]);

  const sendMessage = useCallback(async (text: string, navigate: NavigateFunction, image?: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    // ── Contact flow state machine ──────────────────────────────────────────
    if (contactFlow.step === "collecting_email") {
      setContactFlow((f) => ({ ...f, step: "collecting_message", email: trimmed }));
      setMessages((prev) => [
        ...prev,
        { role: "user",      content: trimmed },
        { role: "assistant", content: "Got it. Now, what would you like to say?" },
      ]);
      return;
    }

    if (contactFlow.step === "collecting_message") {
      setMessages((prev) => [...prev, { role: "user", content: trimmed }]);
      setContactFlow((f) => ({ ...f, step: "sending", message: trimmed }));
      setLoading(true);
      try {
        const res = await fetch("/api/contact", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: "", email: contactFlow.email, message: trimmed }),
        });
        if (!res.ok) throw new Error("contact API error");
        setContactFlow((f) => ({ ...f, step: "done" }));
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: "Message sent! I'll get back to you soon." },
        ]);
      } catch {
        setContactFlow((f) => ({ ...f, step: "error" }));
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: "Sorry, something went wrong sending your message. Please try again." },
        ]);
      } finally {
        setLoading(false);
      }
      return;
    }

    // ── Normal AI chat flow (SSE tool-use loop) ─────────────────────────────
    const userMessage: ChatMessage = { role: "user", content: trimmed, ...(image ? { imageUrl: image } : {}) };
    const nextHistory = [...messages, userMessage];
    setMessages(nextHistory);
    setLoading(true);

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

        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const payload = line.slice(6).trim();

          let event: SSEEvent;
          try { event = JSON.parse(payload); } catch { continue; }

          if (event.type === "token") {
            setLoading(false);
            setMessages((prev) => {
              const next = [...prev];
              const lastIdx = next.length - 1;
              const last = next[lastIdx];
              if (lastIdx >= 0 && last.role === "assistant" && !last.actionHint) {
                next[lastIdx] = { ...last, content: (last.content || "") + event.content };
              } else {
                next.push({ role: "assistant", content: event.content });
              }
              return next;
            });
          } else if (event.type === "tool_call") {
            const toolCall: ToolCall = {
              id:        `tc-${Date.now()}-${toolCallCounter++}`,
              tool:      event.tool,
              summary:   event.summary,
              timestamp: Date.now(),
            };
            pendingToolCalls.push(toolCall);

            setMessages((prev) => {
              const next = [...prev];
              const last = next[next.length - 1];
              if (last.role === "assistant" && !last.actionHint) {
                next[next.length - 1] = { ...last, content: "", toolCalls: [...pendingToolCalls] };
              } else {
                next.push({ role: "assistant", content: "", toolCalls: [...pendingToolCalls] });
              }
              return next;
            });
          } else if (event.type === "response") {
            const action = buildAction(event.action ?? null);
            const hintAction =
              action?.type === "navigate" || action?.type === "redirect"
                ? (action as Exclude<AgentAction, { type: "contact" }>)
                : undefined;

            const finalContent = event.content || ".";

            setMessages((prev) => {
              const next = [...prev];
              const lastIdx = next.length - 1;
              const last = next[lastIdx];
              if (last?.role === "assistant" && !last.actionHint) {
                next[lastIdx] = {
                  ...last,
                  content:    finalContent,
                  actionHint: hintAction ? actionLabel(hintAction) : undefined,
                  toolCalls:  pendingToolCalls.length > 0 ? [...pendingToolCalls] : undefined,
                };
              } else {
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
              if (action.type === "contact") {
                setContactFlow({ step: "collecting_email", email: "", message: "" });
                setMessages((prev) => [
                  ...prev,
                  { role: "assistant", content: "What's your email address?" },
                ]);
              } else {
                executeAction(action, navigate);
              }
            }
          } else if (event.type === "done") {
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
  }, [messages, loading, contactFlow]);

  return (
    <ChatContext.Provider value={{ messages, setMessages, loading, contactFlow, setContactFlow, sendMessage }}>
      {children}
    </ChatContext.Provider>
  );
}

// ── Consumer hook ─────────────────────────────────────────────────────────────
export function useChatContext(): ChatContextValue {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error("useChatContext must be used inside <ChatProvider>");
  return ctx;
}
