import { useRef, useEffect, FormEvent, KeyboardEvent, RefObject } from "react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface ChatBotProps {
  sectionRef: RefObject<HTMLElement>;
  messages: Message[];
  input: string;
  loading: boolean;
  setInput: (value: string) => void;
  onSend: (text: string) => void;
}

/**
 * ChatBot — editorial-styled conversational interface.
 * State is lifted to Home so the hero chat bar shares the same conversation.
 */
export default function ChatBot({ sectionRef, messages, input, loading, setInput, onSend }: ChatBotProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to newest message after each exchange
  useEffect(() => {
    if (messages.length <= 1) return;
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSend(input);
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    onSend(input);
  };

  return (
    <section ref={sectionRef} className="home-section home-chatbot-section">
      <div className="home-section-inner">
        <h2 className="section-heading">Let's chat!</h2>

        {/* Scrollable message window */}
        <div className="chatbot-window" aria-live="polite" aria-label="Chat conversation">
          <div className="chatbot-messages">
            {messages.map((msg, i) => (
              <div key={i} className={`chatbot-bubble chatbot-bubble--${msg.role}`}>
                <span className="chatbot-bubble-role">
                  {msg.role === "user" ? "YOU" : "Yuyang"}
                </span>
                <p className="chatbot-bubble-text">{msg.content}</p>
              </div>
            ))}

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
            &#8594;
          </button>
        </form>
      </div>
    </section>
  );
}
