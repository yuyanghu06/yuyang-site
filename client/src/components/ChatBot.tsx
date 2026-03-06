import { useState, useRef, useEffect, FormEvent, KeyboardEvent } from "react";

// Shape of a single chat message displayed in the window
interface Message {
  role: "user" | "assistant";
  content: string;
}

/**
 * ChatBot — editorial-styled conversational interface.
 * Sits at the bottom of the homepage as a full-width section.
 * Maintains a local conversation history and streams replies
 * through the /api/chat NestJS endpoint.
 */
export default function ChatBot() {
  // Full message history shown in the scrollable window
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "Hi, I'm the AI version of Yuyang. Ask me anything!",
    },
  ]);

  // Current value of the text input
  const [input, setInput] = useState("");

  // Tracks whether we're waiting for the server response
  const [loading, setLoading] = useState(false);

  // Ref used to auto-scroll the message window to the bottom on each new message
  const bottomRef = useRef<HTMLDivElement>(null);

  // Only scroll when a real conversation exchange occurs (more than the initial greeting)
  useEffect(() => {
    if (messages.length <= 1) return;
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  /**
   * Send the current input to /api/chat and append both the user message
   * and the assistant reply to the conversation history.
   */
  const sendMessage = async () => {
    const text = input.trim();
    if (!text || loading) return;

    // Append user message immediately so the UI feels responsive
    const userMsg: Message = { role: "user", content: text };
    const nextHistory = [...messages, userMsg];
    setMessages(nextHistory);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Send full history (excluding the initial assistant greeting) to maintain context
        body: JSON.stringify({
          messages: nextHistory.map(({ role, content }) => ({ role, content })),
        }),
      });

      if (!res.ok) throw new Error("API error");

      const data: { reply: string } = await res.json();

      // Append assistant reply
      setMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
    } catch {
      // Surface a soft error message in the chat window rather than crashing
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Sorry, something went wrong. Please try again." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  // Allow Submit via Enter (Shift+Enter inserts newline)
  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void sendMessage();
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    void sendMessage();
  };

  return (
    <section className="home-section home-chatbot-section">
      <div className="home-section-inner">
        {/* Section label — matches existing editorial style */}
        <h2 className="section-heading">Let's chat!</h2>

        {/* Scrollable message window */}
        <div className="chatbot-window" aria-live="polite" aria-label="Chat conversation">
          <div className="chatbot-messages">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`chatbot-bubble chatbot-bubble--${msg.role}`}
              >
                {/* Role label above each bubble */}
                <span className="chatbot-bubble-role">
                  {msg.role === "user" ? "YOU" : "Yuyang"}
                </span>
                <p className="chatbot-bubble-text">{msg.content}</p>
              </div>
            ))}

            {/* Typing indicator while waiting for a response */}
            {loading && (
              <div className="chatbot-bubble chatbot-bubble--assistant chatbot-bubble--loading">
                <span className="chatbot-bubble-role">AI</span>
                <p className="chatbot-bubble-text chatbot-typing">
                  <span />
                  <span />
                  <span />
                </p>
              </div>
            )}

            {/* Invisible anchor for auto-scroll */}
            <div ref={bottomRef} />
          </div>
        </div>

        {/* Input row */}
        <form className="chatbot-input-row" onSubmit={handleSubmit}>
          <input
            className="chatbot-input"
            type="text"
            placeholder="Ask me anything…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={loading}
            autoComplete="off"
            aria-label="Chat input"
          />
          <button
            className="chatbot-send"
            type="submit"
            disabled={loading || !input.trim()}
            aria-label="Send message"
          >
            {/* Right-arrow send icon — pure CSS, no dependencies */}
            &#8594;
          </button>
        </form>
      </div>
    </section>
  );
}
