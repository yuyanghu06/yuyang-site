import { createContext, useContext, useState, useEffect, useCallback, ReactNode, Dispatch, SetStateAction } from "react";
import type { NavigateFunction } from "react-router-dom";
import { parseActions, executeAction, actionLabel, type AgentAction } from "../lib/chatActions";

// ── Shared message type ───────────────────────────────────────────────────────
export interface ChatMessage {
  role:        "user" | "assistant";
  content:     string;
  // Optional label shown beneath a bubble when the model triggered a navigate/redirect
  actionHint?: string;
}

// ── Contact-collection flow ───────────────────────────────────────────────────
// When the AI returns a [contact] action tag, the frontend collects email then
// message locally without round-tripping to the model.
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

// sessionStorage key — persists across React Router navigation, clears on refresh
const STORAGE_KEY = "chatHistory";

// Initial greeting injected at the top of every new session
export const CHAT_GREETING: ChatMessage = {
  role:    "assistant",
  content: "Hi, I'm the AI version of Yuyang. Ask me anything about my projects, personal life, etc! " +
           "I have access to information about everyone in my life, can help you navigate the site, " +
           "or can redirect you to the links to my various projects, social media, etc.",
};

// ── Context shape ─────────────────────────────────────────────────────────────
interface ChatContextValue {
  messages:     ChatMessage[];
  setMessages:  Dispatch<SetStateAction<ChatMessage[]>>;
  loading:      boolean;
  contactFlow:  ContactFlow;
  setContactFlow: Dispatch<SetStateAction<ContactFlow>>;
  /**
   * Send a message through the full chat pipeline.
   * @param text     The raw user input to send.
   * @param navigate React Router navigate function from the calling component,
   *                 required to execute [navigate] action tags from the model.
   */
  sendMessage:  (text: string, navigate: NavigateFunction) => Promise<void>;
}

const ChatContext = createContext<ChatContextValue | null>(null);

// ── Provider ──────────────────────────────────────────────────────────────────
/**
 * ChatProvider — wraps the app and provides shared chat state + send logic.
 * Restores messages from sessionStorage on mount; writes back on every change.
 * Accessible from any page so the SpotlightButton can chat from any route.
 */
export function ChatProvider({ children }: { children: ReactNode }) {
  // Restore from sessionStorage on first mount; fall back to greeting only
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      return saved ? (JSON.parse(saved) as ChatMessage[]) : [CHAT_GREETING];
    } catch {
      return [CHAT_GREETING];
    }
  });

  const [loading,     setLoading]     = useState(false);
  const [contactFlow, setContactFlow] = useState<ContactFlow>(INITIAL_CONTACT_FLOW);

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
  const sendMessage = useCallback(async (text: string, navigate: NavigateFunction) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    // ── Contact flow state machine ──────────────────────────────────────────
    if (contactFlow.step === "collecting_email") {
      // Treat input as the user's email address
      setContactFlow((f) => ({ ...f, step: "collecting_message", email: trimmed }));
      setMessages((prev) => [
        ...prev,
        { role: "user",      content: trimmed },
        { role: "assistant", content: "Got it. Now, what would you like to say?" },
      ]);
      return;
    }

    if (contactFlow.step === "collecting_message") {
      // Treat input as the message body and POST to /api/contact
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
          { role: "assistant", content: "Message sent! Yuyang will get back to you soon." },
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

    // ── Normal AI chat flow ──────────────────────────────────────────────────
    const nextHistory = [...messages, { role: "user" as const, content: trimmed }];
    setMessages(nextHistory);
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: nextHistory.map(({ role, content }) => ({ role, content })),
        }),
      });
      if (!res.ok) throw new Error("API error");

      const data: { reply: string } = await res.json();
      const { display, actions } = parseActions(data.reply);

      // Surface the first navigate/redirect as a visible action hint
      const hintAction = actions.find((a): a is Exclude<AgentAction, { type: "contact" }> =>
        a.type === "navigate" || a.type === "redirect"
      );

      setMessages((prev) => [
        ...prev,
        {
          role:       "assistant",
          content:    display || "—",
          actionHint: hintAction ? actionLabel(hintAction) : undefined,
        },
      ]);

      // Execute all parsed action tags
      for (const action of actions) {
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
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Sorry, something went wrong. Please try again." },
      ]);
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
/** Returns shared chat state + send logic. Must be inside <ChatProvider>. */
export function useChatContext(): ChatContextValue {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error("useChatContext must be used inside <ChatProvider>");
  return ctx;
}
