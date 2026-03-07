import { useState, useRef, useEffect, FormEvent, KeyboardEvent } from "react";
import { useNavigate } from "react-router-dom";
import { FaCommentDots } from "react-icons/fa";
import { useChatContext } from "../context/ChatContext";

/**
 * SpotlightButton — a fixed liquid-glass circular icon at the bottom-left of
 * the viewport.  Clicking it opens a panel with the full chat log and an input
 * bar so the user can continue the conversation from any page.
 *
 * State and send logic live in ChatContext so the conversation is shared with
 * the Home page and persists across React Router navigation.
 */
export default function SpotlightButton() {
  const navigate = useNavigate();
  const { messages, loading, contactFlow, sendMessage } = useChatContext();

  // Controls panel visibility
  const [open,  setOpen]  = useState(false);
  // Local input value — scoped to this component, not shared with Home's input
  const [input, setInput] = useState("");

  // Wraps the button + panel for outside-click detection
  const rootRef   = useRef<HTMLDivElement>(null);
  // Keeps the message list scrolled to the bottom
  const bottomRef = useRef<HTMLDivElement>(null);
  // Focuses the input field when the panel opens
  const inputRef  = useRef<HTMLInputElement>(null);

  // Scroll to newest message when the panel opens or a new message arrives
  useEffect(() => {
    if (!open) return;
    const id = requestAnimationFrame(() => {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    });
    return () => cancelAnimationFrame(id);
  }, [open, messages]);

  // Auto-focus the input whenever the panel opens
  useEffect(() => {
    if (open) {
      const id = setTimeout(() => inputRef.current?.focus(), 60);
      return () => clearTimeout(id);
    }
  }, [open]);

  // Close the panel when the user clicks outside the root element
  useEffect(() => {
    if (!open) return;
    const handleOutside = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [open]);

  const handleSend = async (text: string) => {
    if (!text.trim() || loading) return;
    setInput("");
    // Pass the router's navigate so the model can execute [navigate] actions
    await sendMessage(text, navigate);
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    void handleSend(input);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend(input);
    }
  };

  // Placeholder text adapts to the contact-collection flow step
  const placeholder =
    contactFlow.step === "collecting_email"   ? "your email address…"   :
    contactFlow.step === "collecting_message" ? "your message…"          :
    "message Yuyang…";

  const exchangeCount = messages.length - 1;
  const hasHistory    = exchangeCount > 0;

  return (
    <div className="spotlight-root" ref={rootRef}>

      {/* ── Chat panel — slides up from the button ── */}
      {open && (
        <div className="spotlight-panel" role="dialog" aria-label="Chat">

          {/* Header */}
          <div className="spotlight-panel-header">
            <span className="spotlight-panel-title">Chat</span>
            <button
              className="spotlight-panel-close"
              onClick={() => setOpen(false)}
              aria-label="Close chat"
            >
              ✕
            </button>
          </div>

          {/* Scrollable message list */}
          <div className="spotlight-panel-messages">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`spotlight-bubble spotlight-bubble--${msg.role}`}
              >
                <span className="spotlight-bubble-role">
                  {msg.role === "user" ? "YOU" : "Yuyang"}
                </span>
                <p className="spotlight-bubble-text">{msg.content}</p>
                {msg.actionHint && (
                  <span className="spotlight-action-hint">{msg.actionHint}</span>
                )}
              </div>
            ))}

            {/* Animated typing indicator while waiting for a reply */}
            {loading && (
              <div className="spotlight-bubble spotlight-bubble--assistant">
                <span className="spotlight-bubble-role">Yuyang</span>
                <p className="spotlight-bubble-text spotlight-typing">
                  <span /><span /><span />
                </p>
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* ── Input bar ── */}
          <div className="spotlight-input-wrap">
            <form className="spotlight-form" onSubmit={handleSubmit}>
              <input
                ref={inputRef}
                className="spotlight-input"
                type="text"
                placeholder={placeholder}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={loading}
                autoComplete="off"
                aria-label="Chat input"
              />
              <button
                className="spotlight-send"
                type="submit"
                disabled={loading || !input.trim()}
                aria-label="Send message"
              >
                &#8593;
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ── Circular liquid-glass trigger button ── */}
      <button
        className={`spotlight-btn${hasHistory ? " spotlight-btn--active" : ""}`}
        onClick={() => setOpen((prev) => !prev)}
        aria-label={open ? "Close chat" : "Open chat"}
        aria-expanded={open}
      >
        <FaCommentDots className="spotlight-btn-icon" />
        {hasHistory && (
          <span className="spotlight-btn-badge" aria-hidden="true">
            {exchangeCount > 99 ? "99+" : exchangeCount}
          </span>
        )}
      </button>
    </div>
  );
}
