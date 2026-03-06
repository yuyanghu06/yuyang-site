import { useState, useRef, useEffect, FormEvent, KeyboardEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { FaInstagram, FaLinkedinIn, FaGithub } from "react-icons/fa";
import { IconType } from "react-icons";
import { CONFIG } from "../config";
import "../styles/hero.css";

const SOCIAL_ICONS: Record<string, IconType> = {
  instagram: FaInstagram,
  linkedin:  FaLinkedinIn,
  github:    FaGithub,
};

interface Message {
  role: "user" | "assistant";
  content: string;
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: "Hi, I'm the AI version of Yuyang. Ask me anything!" },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  // True once the user sends a first message — triggers the full chat layout
  const [chatActive, setChatActive] = useState(false);
  // Invisible scroll anchor kept at the bottom of the message list
  const heroChatBottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to the newest message after every update
  useEffect(() => {
    heroChatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || loading) return;

    // Expand into full chat mode on the very first send
    setChatActive(true);

    const userMsg: Message = { role: "user", content: text.trim() };
    const nextHistory = [...messages, userMsg];
    setMessages(nextHistory);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: nextHistory.map(({ role, content }) => ({ role, content })),
        }),
      });

      if (!res.ok) throw new Error("API error");

      const data: { reply: string } = await res.json();
      setMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Sorry, something went wrong. Please try again." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleHeroSubmit = (e: FormEvent) => {
    e.preventDefault();
    void sendMessage(input);
  };

  const handleHeroKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void sendMessage(input);
    }
  };

  // Reset everything and return to the normal homepage
  const resetChat = () => {
    setChatActive(false);
    setMessages([{ role: "assistant", content: "Hi, I'm the AI version of Yuyang. Ask me anything!" }]);
    setInput("");
    setLoading(false);
  };

  /* ── Slide variants ───────────────────────────────────────────────────────
     Chat rises up from below when opened; the home page settles back down
     from slightly above when returning. mode="wait" ensures the exiting
     view fully leaves before the entering view starts.                    ── */
  return (
    <AnimatePresence mode="wait" initial={false}>
      {chatActive ? (

        /* ── Full-screen chat ── */
        <motion.div
          key="chat"
          className="chat-fullscreen"
          initial={{ y: "6%", opacity: 0 }}
          animate={{ y: 0,    opacity: 1 }}
          exit={{    y: "6%", opacity: 0 }}
          transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
        >
          <header className="chat-fs-header">
            <span className="chat-fs-brand">{CONFIG.heroText}</span>
            <button className="chat-fs-back" onClick={resetChat} aria-label="Back to homepage">
              ← back
            </button>
          </header>

          <div className="chat-fs-messages" aria-live="polite" aria-label="Chat conversation">
            <div className="chat-fs-messages-inner">
              {messages.map((msg, i) => (
                <div key={i} className={`chat-fs-bubble chat-fs-bubble--${msg.role}`}>
                  <span className="chat-fs-bubble-role">
                    {msg.role === "user" ? "YOU" : "Yuyang"}
                  </span>
                  <p className="chat-fs-bubble-text">{msg.content}</p>
                </div>
              ))}

              {loading && (
                <div className="chat-fs-bubble chat-fs-bubble--assistant">
                  <span className="chat-fs-bubble-role">Yuyang</span>
                  <p className="chat-fs-bubble-text chat-fs-typing">
                    <span /><span /><span />
                  </p>
                </div>
              )}

              <div ref={heroChatBottomRef} />
            </div>
          </div>

          <div className="chat-fs-input-wrap">
            <form className="chat-fs-form" onSubmit={handleHeroSubmit}>
              <input
                className="chat-fs-input"
                type="text"
                placeholder="message Yuyang…"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleHeroKeyDown}
                disabled={loading}
                autoComplete="off"
                aria-label="Chat input"
              />
              <button
                className="chat-fs-send"
                type="submit"
                disabled={loading || !input.trim()}
                aria-label="Send message"
              >
                &#8593;
              </button>
            </form>
          </div>
        </motion.div>

      ) : (

        /* ── Normal homepage ── */
        <motion.div
          key="home"
          className="home"
          initial={{ y: "-4%", opacity: 0 }}
          animate={{ y: 0,     opacity: 1 }}
          exit={{    y: "-4%", opacity: 0 }}
          transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
        >
          <section className="hero">

            <div className="hero-center">
              <h1 className="hero-display">{CONFIG.heroText}</h1>

              <form className="hero-chat-bar" onSubmit={handleHeroSubmit}>
                <input
                  className="hero-chat-input"
                  type="text"
                  placeholder="ask me anything"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleHeroKeyDown}
                  disabled={loading}
                  autoComplete="off"
                  aria-label="Chat input"
                />
                <button
                  className="hero-chat-send"
                  type="submit"
                  disabled={loading || !input.trim()}
                  aria-label="Send message"
                >
                  &#8594;
                </button>
              </form>
            </div>

            <footer className="hero-footer">
              <hr className="hero-rule" />
              <div className="hero-socials">
                {CONFIG.socialLinks.map(({ label, icon, href }) => {
                  const Icon = SOCIAL_ICONS[icon];
                  return (
                    <a key={label} href={href} aria-label={label} target="_blank" rel="noreferrer">
                      {Icon ? <Icon /> : icon}
                    </a>
                  );
                })}
              </div>
            </footer>
          </section>

          {/* ── Featured Project ── */}
          <section className="home-section home-featured">
            <div className="home-section-inner">
              <span className="section-label">{CONFIG.featuredStory.label}</span>
              <h2 className="section-heading">{CONFIG.featuredStory.heading}</h2>
              {CONFIG.featuredStory.body.split("\n").map((para, i) => (
                <p key={i} className="section-body">{para.trim()}</p>
              ))}
              <a className="section-cta" href="https://github.com/yuyanghu06/journey">{CONFIG.featuredStory.cta}</a>
            </div>
          </section>

          {/* ── Skills ── */}
          <section className="home-section home-grid-section">
            <div className="home-section-inner">
              <span className="section-label">SKILLS</span>
              <div className="story-grid">
                {CONFIG.stories.map((s) => (
                  <article className="story-card" key={s.heading}>
                    <span className="story-card-label">{s.label}</span>
                    <h3 className="story-card-heading">{s.heading}</h3>
                    <p className="story-card-excerpt">{s.excerpt}</p>
                  </article>
                ))}
              </div>
            </div>
          </section>
        </motion.div>

      )}
    </AnimatePresence>
  );
}
