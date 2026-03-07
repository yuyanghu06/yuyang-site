import { useState, useRef, useEffect, FormEvent, KeyboardEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { FaInstagram, FaLinkedinIn, FaGithub } from "react-icons/fa";
import { IconType } from "react-icons";
import { CONFIG } from "../config";
import { parseActions, executeAction, actionLabel, type AgentAction } from "../lib/chatActions";
import "../styles/hero.css";

const SOCIAL_ICONS: Record<string, IconType> = {
  instagram: FaInstagram,
  linkedin:  FaLinkedinIn,
  github:    FaGithub,
};

// ── Message type ─────────────────────────────────────────────────────────────
interface Message {
  role:    "user" | "assistant";
  content: string;
  // Optional action indicator shown beneath the bubble (e.g. "→ Navigated to projects")
  actionHint?: string;
}

// Steps for the guided contact-collection flow.
// When the AI returns [contact], the frontend collects email then message
// locally without round-tripping to the model.
type ContactStep = "idle" | "collecting_email" | "collecting_message" | "sending" | "done" | "error";

interface ContactFlow {
  step:    ContactStep;
  email:   string;
  message: string;
}

const INITIAL_CONTACT_FLOW: ContactFlow = { step: "idle", email: "", message: "" };

// ── Initial greeting message ────────────────────────────────────────────────
const GREETING = "Hi, I'm the AI version of Yuyang. Ask me anything about my projects, personal life, etc! " +
                 "I have access to information about everyone in my life, can help you navigate the site, " +
                 "or can redirect you to the links to my various projects, social media, etc.";

export default function Home() {
  const location  = useLocation();
  const navigate  = useNavigate();
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: GREETING },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  // True once the user sends a first message — triggers the full chat layout
  const [chatActive, setChatActive] = useState(false);
  // Contact collection flow state — managed entirely on the frontend
  const [contactFlow, setContactFlow] = useState<ContactFlow>(INITIAL_CONTACT_FLOW);
  // Invisible scroll anchor kept at the bottom of the message list
  const heroChatBottomRef = useRef<HTMLDivElement>(null);

  // Reset chat whenever the user navigates to "/" — handles the case where
  // the user is in fullscreen chat and clicks "Home" in the navbar (same
  // route, so the component doesn't remount, but location.key always changes).
  useEffect(() => {
    setChatActive(false);
    setInput("");
    setLoading(false);
    setContactFlow(INITIAL_CONTACT_FLOW);
    setMessages([{ role: "assistant", content: GREETING }]);
  // location.key changes on every navigation to this route, even same-path
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.key]);

  // Auto-scroll to the newest message after every update
  useEffect(() => {
    heroChatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || loading) return;

    const trimmed = text.trim();

    // Expand into full chat mode on the very first send
    setChatActive(true);
    setInput("");

    // ── Contact flow state machine ──────────────────────────────────────────
    // When a [contact] action has been triggered, we collect email and message
    // locally without calling the AI model.
    if (contactFlow.step === "collecting_email") {
      // Treat the user's input as their email address
      const userMsg: Message = { role: "user", content: trimmed };
      setContactFlow((f) => ({ ...f, step: "collecting_message", email: trimmed }));
      setMessages((prev) => [
        ...prev,
        userMsg,
        { role: "assistant", content: "Got it. Now, what would you like to say?" },
      ]);
      return;
    }

    if (contactFlow.step === "collecting_message") {
      // Treat the user's input as their message body — send the email
      const userMsg: Message = { role: "user", content: trimmed };
      setMessages((prev) => [...prev, userMsg]);
      setContactFlow((f) => ({ ...f, step: "sending", message: trimmed }));
      setLoading(true);

      try {
        const res = await fetch("/api/contact", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name:    "",
            email:   contactFlow.email,
            message: trimmed,
          }),
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
    const userMsg: Message = { role: "user", content: trimmed };
    const nextHistory = [...messages, userMsg];
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

      // Parse agent action tags out of the raw reply
      const { display, actions } = parseActions(data.reply);

      // Collect an action hint label (only the first non-contact action)
      const hintAction = actions.find((a): a is Exclude<AgentAction, { type: "contact" }> =>
        a.type === "navigate" || a.type === "redirect"
      );

      setMessages((prev) => [
        ...prev,
        {
          role:        "assistant",
          // If the model replied with only a tag (display is empty), use a fallback
          content:     display || "—",
          actionHint:  hintAction ? actionLabel(hintAction) : undefined,
        },
      ]);

      // Execute all parsed actions
      for (const action of actions) {
        if (action.type === "contact") {
          // Shift into contact collection mode and prompt for email
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
          </header>

          <div className="chat-fs-messages" aria-live="polite" aria-label="Chat conversation">
            <div className="chat-fs-messages-inner">
              {messages.map((msg, i) => (
                <div key={i} className={`chat-fs-bubble chat-fs-bubble--${msg.role}`}>
                  <span className="chat-fs-bubble-role">
                    {msg.role === "user" ? "YOU" : "Yuyang"}
                  </span>
                  <p className="chat-fs-bubble-text">{msg.content}</p>
                  {/* Subtle action indicator — shown when the model triggered a navigate/redirect */}
                  {msg.actionHint && (
                    <span className="chat-fs-action-hint">{msg.actionHint}</span>
                  )}
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
                  placeholder={
                    contactFlow.step === "collecting_email"   ? "your email address…"   :
                    contactFlow.step === "collecting_message" ? "your message…"          :
                    "message Yuyang…"
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
