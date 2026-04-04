import { useState, useRef, useEffect, FormEvent, KeyboardEvent, ChangeEvent } from "react";
import { useNavigate } from "react-router-dom";
import { FaCommentDots, FaCamera, FaExpand } from "react-icons/fa";
import { useChatContext } from "../context/ChatContext";
import MessageContent from "./MessageContent";
import ToolStatusBubble from "./ToolStatusBubble";

/**
 * SpotlightButton — a fixed liquid-glass circular icon at the bottom-left of
 * the viewport.  Clicking it opens a panel with the full chat log and an input
 * bar so the user can continue the conversation from any page.
 *
 * Click-and-hold to drag the button anywhere on screen.
 * The "Expand" button in the panel header navigates to the full chat view.
 */
export default function SpotlightButton() {
  const navigate = useNavigate();
  const { messages, loading, sendMessage } = useChatContext();

  const [open,       setOpen]       = useState(false);
  const [input,      setInput]      = useState("");
  const [image,      setImage]      = useState<string | undefined>(undefined);
  const [isDragging, setIsDragging] = useState(false);

  // Dragged position — null = use CSS default (bottom:2rem, left:2rem)
  const [pos, setPos] = useState<{ left: number; bottom: number } | null>(null);

  // Holds transient drag data across mousemove events without causing re-renders
  const dragInfo = useRef<{
    startMouseX: number;
    startMouseY: number;
    startLeft:   number;
    startBottom: number;
  } | null>(null);

  const rootRef   = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLInputElement>(null);
  const fileRef   = useRef<HTMLInputElement>(null);

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

  // ── Drag-to-reposition ─────────────────────────────────────────────────────
  /**
   * mousedown/touchstart on the button.
   * Tracks movement; if the pointer moves > 4px we classify it as a drag and
   * update the button's position.  If the pointer never moves far enough, we
   * treat the interaction as a click and toggle the panel.
   */
  const startDrag = (startX: number, startY: number) => {
    const startLeft   = pos?.left   ?? 32; // mirrors CSS default 2rem
    const startBottom = pos?.bottom ?? 32;
    let   hasMoved    = false;

    dragInfo.current = { startMouseX: startX, startMouseY: startY, startLeft, startBottom };

    const onMove = (cx: number, cy: number) => {
      const dx = cx - startX;
      const dy = cy - startY;
      if (!hasMoved && (Math.abs(dx) > 4 || Math.abs(dy) > 4)) {
        hasMoved = true;
        setIsDragging(true);
      }
      if (hasMoved) {
        setPos({
          left:   Math.max(8, Math.min(window.innerWidth  - 56, startLeft   + dx)),
          bottom: Math.max(8, Math.min(window.innerHeight - 56, startBottom - dy)),
        });
      }
    };

    const onEnd = () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup",   onMouseUp);
      document.removeEventListener("touchmove", onTouchMove);
      document.removeEventListener("touchend",  onTouchEnd);
      setIsDragging(false);
      dragInfo.current = null;
      if (!hasMoved) setOpen((prev) => !prev);
    };

    const onMouseMove = (e: MouseEvent) => onMove(e.clientX, e.clientY);
    const onMouseUp   = () => onEnd();
    const onTouchMove = (e: TouchEvent) => { e.preventDefault(); onMove(e.touches[0].clientX, e.touches[0].clientY); };
    const onTouchEnd  = () => onEnd();

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup",   onMouseUp);
    document.addEventListener("touchmove", onTouchMove, { passive: false });
    document.addEventListener("touchend",  onTouchEnd);
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    startDrag(e.clientX, e.clientY);
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLButtonElement>) => {
    startDrag(e.touches[0].clientX, e.touches[0].clientY);
  };

  // ── Expand to full chat screen ─────────────────────────────────────────────
  const handleExpand = () => {
    setOpen(false);
    navigate("/", { state: { expandChat: true } });
  };

  // ── Message sending ────────────────────────────────────────────────────────
  const handleSend = async (text: string) => {
    if (!text.trim() || loading) return;
    const pendingImage = image;
    setInput("");
    setImage(undefined);
    await sendMessage(text, navigate, pendingImage);
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setImage(reader.result as string);
    reader.readAsDataURL(file);
    e.target.value = "";
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

  const placeholder = "message Yuyang…";

  const exchangeCount = messages.length - 1;
  const hasHistory    = exchangeCount > 0;

  // Show panel below the button when the button has been dragged near the top
  const showPanelBelow = pos ? pos.bottom > window.innerHeight * 0.55 : false;

  return (
    <div
      className="spotlight-root"
      ref={rootRef}
      style={pos ? { left: pos.left, bottom: pos.bottom } : undefined}
    >

      {/* ── Chat panel ── */}
      {open && (
        <div
          className={`spotlight-panel${showPanelBelow ? " spotlight-panel--below" : ""}`}
          role="dialog"
          aria-label="Chat"
        >

          {/* Header */}
          <div className="spotlight-panel-header">
            <span className="spotlight-panel-title">Chat</span>
            <div className="spotlight-panel-header-actions">
              {/* Expand into full chat screen */}
              <button
                className="spotlight-panel-expand"
                onClick={handleExpand}
                aria-label="Expand conversation"
                title="Expand to full screen"
              >
                <FaExpand />
              </button>
              <button
                className="spotlight-panel-close"
                onClick={() => setOpen(false)}
                aria-label="Close chat"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Scrollable message list */}
          <div className="spotlight-panel-messages">
            {messages.map((msg, i) => (
              <div key={i} className="spotlight-msg-row">
                {msg.toolCalls?.map((tc) => (
                  <ToolStatusBubble key={tc.id} toolCall={tc} />
                ))}
                {msg.content ? (
                  <div className={`spotlight-bubble spotlight-bubble--${msg.role}`}>
                    <span className="spotlight-bubble-role">
                      {msg.role === "user" ? "YOU" : "Yuyang"}
                    </span>
                    {msg.imageUrl && (
                      <img src={msg.imageUrl} alt="Attached" className="chat-bubble-img" />
                    )}
                    <p className="spotlight-bubble-text"><MessageContent content={msg.content} /></p>
                    {msg.actionHint && (
                      <span className="spotlight-action-hint">{msg.actionHint}</span>
                    )}
                  </div>
                ) : null}
              </div>
            ))}

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
                ref={fileRef}
                type="file"
                accept="image/*"
                className="chat-file-input"
                onChange={handleFileChange}
                aria-label="Attach image"
              />
              <button
                type="button"
                className="spotlight-attach"
                onClick={() => fileRef.current?.click()}
                aria-label="Attach image"
              >
                <FaCamera />
              </button>
              {image && (
                <div className="chat-input-thumb">
                  <img src={image} alt="Preview" />
                  <button
                    type="button"
                    className="chat-input-thumb-clear"
                    onClick={() => setImage(undefined)}
                    aria-label="Remove image"
                  >✕</button>
                </div>
              )}
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
        className={`spotlight-btn${hasHistory ? " spotlight-btn--active" : ""}${isDragging ? " spotlight-btn--dragging" : ""}`}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
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
