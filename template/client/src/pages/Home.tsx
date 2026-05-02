import { useState, useRef, useEffect, FormEvent, KeyboardEvent, ChangeEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { FaInstagram, FaLinkedinIn, FaGithub, FaCamera } from "react-icons/fa";
import { IconType } from "react-icons";
import { CONFIG } from "../config";
import { useChatContext, INITIAL_CONTACT_FLOW } from "../context/ChatContext";
import MessageContent from "../components/MessageContent";
import ToolStatusBubble from "../components/ToolStatusBubble";
import "../styles/hero.css";

const SOCIAL_ICONS: Record<string, IconType> = {
  instagram: FaInstagram,
  linkedin:  FaLinkedinIn,
  github:    FaGithub,
};

export default function Home() {
  const location = useLocation();
  const navigate = useNavigate();

  const { messages, loading, contactFlow, setContactFlow, sendMessage } = useChatContext();

  const [input,      setInput]      = useState("");
  const [image,      setImage]      = useState<string | undefined>(undefined);
  const [chatActive, setChatActive] = useState(false);
  const heroChatBottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef      = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setChatActive(false);
    setInput("");
    setImage(undefined);
    setContactFlow(INITIAL_CONTACT_FLOW);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.key]);

  useEffect(() => {
    heroChatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const handleSend = async (text: string) => {
    if (!text.trim() || loading) return;
    setChatActive(true);
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

  const handleHeroSubmit = (e: FormEvent) => {
    e.preventDefault();
    void handleSend(input);
  };

  const handleHeroKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend(input);
    }
  };

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
          </header>

          <div className="chat-fs-messages" aria-live="polite" aria-label="Chat conversation">
            <div className="chat-fs-messages-inner">
              {messages.map((msg, i) => (
                <div key={i}>
                  {msg.toolCalls?.map((tc) => (
                    <ToolStatusBubble key={tc.id} toolCall={tc} />
                  ))}
                  {msg.content ? (
                    <div className={`chat-fs-bubble chat-fs-bubble--${msg.role}`}>
                      <span className="chat-fs-bubble-role">
                        {/* ✏️ Change "AI" to your name or preferred assistant label */}
                        {msg.role === "user" ? "YOU" : "AI"}
                      </span>
                      {msg.imageUrl && (
                        <img src={msg.imageUrl} alt="Attached" className="chat-bubble-img" />
                      )}
                      <p className="chat-fs-bubble-text"><MessageContent content={msg.content} /></p>
                      {msg.actionHint && (
                        <span className="chat-fs-action-hint">{msg.actionHint}</span>
                      )}
                    </div>
                  ) : null}
                </div>
              ))}

              {loading && (
                <div className="chat-fs-bubble chat-fs-bubble--assistant">
                  <span className="chat-fs-bubble-role">AI</span>
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
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="chat-file-input"
                onChange={handleFileChange}
                aria-label="Attach image"
              />
              <button
                type="button"
                className="chat-fs-attach"
                onClick={() => fileInputRef.current?.click()}
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
                  className="chat-fs-input"
                  type="text"
                  placeholder={
                    contactFlow.step === "collecting_email"   ? "your email address…"   :
                    contactFlow.step === "collecting_message" ? "your message…"          :
                    "ask me anything…"
                  }
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
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="chat-file-input"
                  onChange={handleFileChange}
                  aria-label="Attach image"
                />
                <button
                  type="button"
                  className="hero-chat-attach"
                  onClick={() => fileInputRef.current?.click()}
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
              <a className="section-cta" href={CONFIG.featuredStory.ctaHref}>{CONFIG.featuredStory.cta}</a>
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
