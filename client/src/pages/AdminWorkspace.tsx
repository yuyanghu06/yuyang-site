import { useState, useEffect, useRef, useCallback, FormEvent, KeyboardEvent } from "react";
import "../styles/interior.css";

// ── Types ────────────────────────────────────────────────────────────────────

interface WsToolCall {
  id:        string;
  tool:      string;
  summary:   string;
  timestamp: number;
}

interface WsMessage {
  role:       "user" | "assistant";
  content:    string;
  toolCalls?: WsToolCall[];
  imageUrl?:  string;
}

// ── SSE event shapes (same as /api/chat) ─────────────────────────────────────

interface SSEToken    { type: "token";     content: string }
interface SSEToolCall { type: "tool_call"; tool: string; summary: string }
interface SSEResponse { type: "response";  content: string; action: unknown }
interface SSEDone     { type: "done" }
interface SSEError    { type: "error" }
type SSEEvent = SSEToken | SSEToolCall | SSEResponse | SSEDone | SSEError;

// ── Constants ────────────────────────────────────────────────────────────────

const KEY_STORAGE   = "admin_ingest_key";
const CHAT_STORAGE  = "workspace_chat_history";

const GREETING: WsMessage = {
  role:    "assistant",
  content: "Hey. I'm your workspace assistant — I have full access to your knowledge base, projects, " +
           "experiences, and background.\n\nI can help with cover letters, application questions, " +
           "interview prep, professional emails, or anything else where your personal context matters. " +
           "What are we working on?",
};

// ── Component ────────────────────────────────────────────────────────────────

export default function AdminWorkspace() {
  // ── Admin key gate ──────────────────────────────────────────────────────────
  const [adminKey, setAdminKey] = useState("");
  const [unlocked, setUnlocked] = useState(false);

  // ── Chat state ──────────────────────────────────────────────────────────────
  const [messages, setMessages] = useState<WsMessage[]>(() => {
    try {
      const saved = sessionStorage.getItem(CHAT_STORAGE);
      if (saved) return JSON.parse(saved) as WsMessage[];
    } catch { /* fall through */ }
    return [GREETING];
  });
  const [loading, setLoading] = useState(false);
  const [input,   setInput]   = useState("");
  const [image,   setImage]   = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef    = useRef<HTMLTextAreaElement>(null);
  const fileInputRef   = useRef<HTMLInputElement>(null);

  // Restore admin key from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(KEY_STORAGE);
    if (stored) {
      setAdminKey(stored);
      setUnlocked(true);
    }
  }, []);

  // Persist chat to sessionStorage
  useEffect(() => {
    try { sessionStorage.setItem(CHAT_STORAGE, JSON.stringify(messages)); }
    catch { /* silent */ }
  }, [messages]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── Key gate handlers ───────────────────────────────────────────────────────

  const handleUnlock = (e: FormEvent) => {
    e.preventDefault();
    if (adminKey.trim()) {
      localStorage.setItem(KEY_STORAGE, adminKey.trim());
      setUnlocked(true);
    }
  };

  const handleLock = () => {
    localStorage.removeItem(KEY_STORAGE);
    setAdminKey("");
    setUnlocked(false);
  };

  // ── Image handling ──────────────────────────────────────────────────────────

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setImage(reader.result as string);
    reader.readAsDataURL(file);
  };

  const clearImage = () => {
    setImage(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // ── Send message ────────────────────────────────────────────────────────────

  const sendMessage = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || loading) return;

    const userMsg: WsMessage = {
      role: "user",
      content: trimmed,
      ...(image ? { imageUrl: image } : {}),
    };
    const nextHistory = [...messages, userMsg];
    setMessages(nextHistory);
    setInput("");
    setLoading(true);
    clearImage();

    const pendingToolCalls: WsToolCall[] = [];
    let toolCallCounter = 0;

    try {
      const res = await fetch("/api/workspace", {
        method:  "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-key":  adminKey,
        },
        body: JSON.stringify({
          messages: nextHistory.map(({ role, content }) => ({ role, content })),
          ...(image ? { image } : {}),
        }),
      });

      if (!res.ok || !res.body) {
        const body = await res.text().catch(() => "");
        console.error("[Workspace] Request failed | status:", res.status, "| body:", body);
        throw new Error(`HTTP ${res.status}`);
      }

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
              const last = next[next.length - 1];
              if (last?.role === "assistant" && !last.toolCalls?.length) {
                next[next.length - 1] = { ...last, content: (last.content || "") + event.content };
              } else {
                next.push({ role: "assistant", content: event.content });
              }
              return next;
            });
          } else if (event.type === "tool_call") {
            const tc: WsToolCall = {
              id:        `tc-${Date.now()}-${toolCallCounter++}`,
              tool:      event.tool,
              summary:   event.summary,
              timestamp: Date.now(),
            };
            pendingToolCalls.push(tc);

            setMessages((prev) => {
              const next = [...prev];
              const last = next[next.length - 1];
              if (last?.role === "assistant") {
                next[next.length - 1] = { ...last, content: "", toolCalls: [...pendingToolCalls] };
              } else {
                next.push({ role: "assistant", content: "", toolCalls: [...pendingToolCalls] });
              }
              return next;
            });
          } else if (event.type === "response") {
            const finalContent = (event as SSEResponse).content || ".";
            setMessages((prev) => {
              const next = [...prev];
              const last = next[next.length - 1];
              if (last?.role === "assistant") {
                next[next.length - 1] = {
                  ...last,
                  content:   finalContent,
                  toolCalls: pendingToolCalls.length > 0 ? [...pendingToolCalls] : undefined,
                };
              } else {
                next.push({
                  role: "assistant",
                  content: finalContent,
                  toolCalls: pendingToolCalls.length > 0 ? [...pendingToolCalls] : undefined,
                });
              }
              return next;
            });
            setLoading(false);
          } else if (event.type === "done") {
            setLoading(false);
          } else if (event.type === "error") {
            setMessages((prev) => [...prev, { role: "assistant", content: "Something went wrong. Try again." }]);
            setLoading(false);
          }
        }
      }
    } catch (err) {
      console.error("[Workspace] sendMessage error:", err);
      setMessages((prev) => [...prev, { role: "assistant", content: "Something went wrong. Try again." }]);
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input, image, messages, loading, adminKey]);

  // ── Keyboard handling ───────────────────────────────────────────────────────

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // ── Auto-resize textarea ───────────────────────────────────────────────────

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const el = e.target;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 200) + "px";
  };

  // ── Clear chat ─────────────────────────────────────────────────────────────

  const clearChat = () => {
    setMessages([GREETING]);
    sessionStorage.removeItem(CHAT_STORAGE);
  };

  // ── Copy text to clipboard ────────────────────────────────────────────────

  const copyText = (text: string) => {
    navigator.clipboard.writeText(text).catch(() => { /* silent */ });
  };

  // ══════════════════════════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════════════════════════

  // Key gate
  if (!unlocked) {
    return (
      <div className="admin-ingest-page">
        <div className="admin-card">
          <h1 className="admin-title">Workspace</h1>
          <p className="admin-subtitle">Enter access key to continue.</p>
          <form onSubmit={handleUnlock} className="admin-form">
            <input
              type="password"
              className="admin-input"
              placeholder="Access key"
              value={adminKey}
              onChange={(e) => setAdminKey(e.target.value)}
              autoFocus
            />
            <button type="submit" className="admin-btn" disabled={!adminKey.trim()}>
              Unlock
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Chat UI
  return (
    <div className="ws-page">
      {/* Header bar */}
      <div className="ws-header">
        <div className="ws-header-left">
          <h1 className="ws-title">Workspace</h1>
          <span className="ws-subtitle">Private reasoning assistant</span>
        </div>
        <div className="ws-header-actions">
          <button type="button" className="ws-header-btn" onClick={() => window.location.href = "/admin/ingest"}>
            Ingest
          </button>
          <button type="button" className="ws-header-btn" onClick={clearChat}>
            Clear
          </button>
          <button type="button" className="ws-header-btn" onClick={handleLock}>
            Lock
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="ws-messages">
        {messages.map((msg, i) => (
          <div key={i} className={`ws-bubble ws-bubble--${msg.role}`}>
            {/* Tool call status bubbles */}
            {msg.toolCalls && msg.toolCalls.length > 0 && (
              <div className="ws-tool-calls">
                {msg.toolCalls.map((tc) => (
                  <div key={tc.id} className={`ws-tool-pill ws-tool-pill--${tc.tool}`}>
                    <span className="ws-tool-dot" />
                    {tc.summary}
                  </div>
                ))}
              </div>
            )}
            {/* Image preview for user messages */}
            {msg.imageUrl && (
              <img src={msg.imageUrl} alt="Uploaded" className="ws-msg-image" />
            )}
            {/* Message text */}
            {msg.content && (
              <div className="ws-msg-text">{msg.content}</div>
            )}
            {/* Copy button for assistant messages */}
            {msg.role === "assistant" && msg.content && (
              <button
                type="button"
                className="ws-copy-btn"
                onClick={() => copyText(msg.content)}
                title="Copy to clipboard"
              >
                Copy
              </button>
            )}
          </div>
        ))}

        {/* Loading indicator */}
        {loading && (
          <div className="ws-bubble ws-bubble--assistant">
            <div className="ws-typing">
              <span /><span /><span />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="ws-input-area">
        {/* Image preview */}
        {image && (
          <div className="ws-image-preview">
            <img src={image} alt="Preview" />
            <button type="button" className="ws-image-remove" onClick={clearImage}>×</button>
          </div>
        )}
        <div className="ws-input-row">
          <button
            type="button"
            className="ws-attach-btn"
            onClick={() => fileInputRef.current?.click()}
            title="Attach image"
          >
            +
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            onChange={handleImageSelect}
          />
          <textarea
            ref={textareaRef}
            className="ws-textarea"
            placeholder="What are we working on?"
            rows={1}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            disabled={loading}
          />
          <button
            type="button"
            className="ws-send-btn"
            onClick={sendMessage}
            disabled={!input.trim() || loading}
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
