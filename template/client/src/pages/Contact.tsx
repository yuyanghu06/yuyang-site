import { useState, FormEvent } from "react";
import Navbar from "../components/Navbar";
import PageWrapper from "../components/PageWrapper";
import "../styles/interior.css";

export default function Contact() {
  const [form, setForm] = useState({ email: "", message: "" });
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setStatus("sending");

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name:    "",
          email:   form.email,
          message: form.message,
        }),
      });

      setStatus(res.ok ? "sent" : "error");
    } catch {
      setStatus("error");
    }
  };

  return (
    <PageWrapper>
      <Navbar />
      <div className="page-content">
        <header className="page-header">
          <h1>Contact</h1>
          <p className="page-header-sub">Get in touch</p>
        </header>

        <div className="contact-card">
          {status === "sent" ? (
            <div className="contact-success-wrap">
              <span className="contact-success-icon">✦</span>
              <p className="contact-success-msg">Message sent — I'll be in touch soon.</p>
            </div>
          ) : (
            <form className="contact-form" onSubmit={handleSubmit} noValidate>
              <div className="contact-field">
                <label className="contact-label" htmlFor="contact-email">
                  YOUR EMAIL
                </label>
                <input
                  id="contact-email"
                  className="contact-input"
                  type="email"
                  placeholder="you@example.com"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  required
                  disabled={status === "sending"}
                />
              </div>

              <div className="contact-field">
                <label className="contact-label" htmlFor="contact-message">
                  MESSAGE
                </label>
                <textarea
                  id="contact-message"
                  className="contact-input contact-textarea"
                  placeholder="What's on your mind?"
                  value={form.message}
                  onChange={(e) => setForm({ ...form, message: e.target.value })}
                  required
                  disabled={status === "sending"}
                />
              </div>

              {status === "error" && (
                <p className="contact-error">Something went wrong — please try again.</p>
              )}

              <button
                className="contact-submit"
                type="submit"
                disabled={status === "sending"}
              >
                {status === "sending" ? "SENDING…" : "SEND MESSAGE"}
              </button>
            </form>
          )}
        </div>
      </div>
    </PageWrapper>
  );
}
