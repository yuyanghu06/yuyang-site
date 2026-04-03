import { useState, useEffect, FormEvent } from "react";
import "../styles/interior.css";

const STORAGE_KEY = "admin_ingest_key";

/**
 * AdminIngest
 * -----------
 * Key-protected admin page for uploading PDFs or raw text into Pinecone.
 * Accessible only at /admin/ingest (not linked from site navigation).
 *
 * Flow:
 *   1. User enters admin key → stored in localStorage for persistence
 *   2. PDF upload or text input → POST to /api/ingest/pdf or /api/ingest/text
 *   3. Key sent in x-admin-key header on every request
 */
export default function AdminIngest() {
  const [adminKey, setAdminKey]       = useState("");
  const [unlocked, setUnlocked]       = useState(false);
  const [status,   setStatus]         = useState<string | null>(null);
  const [error,    setError]          = useState<string | null>(null);
  const [loading,  setLoading]        = useState(false);

  // Text input state
  const [text,        setText]        = useState("");
  const [sourceLabel, setSourceLabel] = useState("");

  // PDF input state
  const [pdfFile, setPdfFile] = useState<File | null>(null);

  // Markdown input state
  const [markdownFile, setMarkdownFile] = useState<File | null>(null);

  // On mount, restore key from localStorage and auto-unlock if present
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      setAdminKey(stored);
      setUnlocked(true);
    }
  }, []);

  const handleUnlock = (e: FormEvent) => {
    e.preventDefault();
    if (adminKey.trim()) {
      localStorage.setItem(STORAGE_KEY, adminKey.trim());
      setUnlocked(true);
      setError(null);
    }
  };

  const handleLock = () => {
    localStorage.removeItem(STORAGE_KEY);
    setAdminKey("");
    setUnlocked(false);
    setStatus(null);
    setError(null);
  };

  const handleTextSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;

    setLoading(true);
    setStatus(null);
    setError(null);

    try {
      const res = await fetch("/api/ingest/text", {
        method:  "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-key":  adminKey,
        },
        body: JSON.stringify({ text, source: sourceLabel || undefined }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({ message: "Request failed" }));
        throw new Error(data.message || `Error ${res.status}`);
      }

      const data = await res.json();
      setStatus(`Text ingested successfully. ${data.chunksCreated} chunks created.`);
      setText("");
      setSourceLabel("");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handlePdfSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!pdfFile) return;

    setLoading(true);
    setStatus(null);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", pdfFile);

      const res = await fetch("/api/ingest/pdf", {
        method:  "POST",
        headers: { "x-admin-key": adminKey },
        body:    formData,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({ message: "Request failed" }));
        throw new Error(data.message || `Error ${res.status}`);
      }

      const data = await res.json();
      setStatus(`PDF ingested successfully. ${data.chunksCreated} chunks created.`);
      setPdfFile(null);
      // Reset the file input
      const input = document.getElementById("pdf-input") as HTMLInputElement;
      if (input) input.value = "";
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkdownSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!markdownFile) return;

    setLoading(true);
    setStatus(null);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", markdownFile);

      const res = await fetch("/api/ingest/markdown", {
        method:  "POST",
        headers: { "x-admin-key": adminKey },
        body:    formData,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({ message: "Request failed" }));
        throw new Error(data.message || `Error ${res.status}`);
      }

      const data = await res.json();
      setStatus(`Markdown ingested successfully. ${data.chunksCreated} chunks created.`);
      setMarkdownFile(null);
      // Reset the file input
      const input = document.getElementById("markdown-input") as HTMLInputElement;
      if (input) input.value = "";
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  // ── Key gate ──────────────────────────────────────────────────────────────
  if (!unlocked) {
    return (
      <div className="admin-ingest-page">
        <div className="admin-card">
          <h1 className="admin-title">Admin Ingest</h1>
          <p className="admin-subtitle">Enter the access key to continue.</p>
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

  // ── Ingest UI ─────────────────────────────────────────────────────────────
  return (
    <div className="admin-ingest-page">
      <div className="admin-card admin-card--wide">
        <div className="admin-header-row">
          <div>
            <h1 className="admin-title">Ingest Data</h1>
            <p className="admin-subtitle">Upload PDFs, Markdown files, or paste raw text to index in Pinecone.</p>
          </div>
          <button type="button" className="admin-btn admin-btn--lock" onClick={handleLock}>
            Lock
          </button>
        </div>

        {/* Status / Error banners */}
        {status && <div className="admin-banner admin-banner--success">{status}</div>}
        {error  && <div className="admin-banner admin-banner--error">{error}</div>}

        <div className="admin-sections">
          {/* ── PDF Upload ────────────────────────────────────────────────── */}
          <section className="admin-section">
            <h2 className="admin-section-title">PDF Upload</h2>
            <form onSubmit={handlePdfSubmit} className="admin-form">
              <input
                id="pdf-input"
                type="file"
                accept=".pdf"
                className="admin-file-input"
                onChange={(e) => setPdfFile(e.target.files?.[0] ?? null)}
              />
              <button type="submit" className="admin-btn" disabled={!pdfFile || loading}>
                {loading ? "Uploading..." : "Upload & Ingest"}
              </button>
            </form>
          </section>

          {/* ── Markdown Upload ──────────────────────────────────────────── */}
          <section className="admin-section">
            <h2 className="admin-section-title">Markdown Upload</h2>
            <form onSubmit={handleMarkdownSubmit} className="admin-form">
              <input
                id="markdown-input"
                type="file"
                accept=".md,.markdown"
                className="admin-file-input"
                onChange={(e) => setMarkdownFile(e.target.files?.[0] ?? null)}
              />
              <button type="submit" className="admin-btn" disabled={!markdownFile || loading}>
                {loading ? "Uploading..." : "Upload & Ingest"}
              </button>
            </form>
          </section>

          {/* ── Text Input ────────────────────────────────────────────────── */}
          <section className="admin-section">
            <h2 className="admin-section-title">Raw Text</h2>
            <form onSubmit={handleTextSubmit} className="admin-form">
              <input
                type="text"
                className="admin-input"
                placeholder="Source label (optional, e.g. 'bio', 'project notes')"
                value={sourceLabel}
                onChange={(e) => setSourceLabel(e.target.value)}
              />
              <textarea
                className="admin-textarea"
                placeholder="Paste or type text to ingest..."
                rows={8}
                value={text}
                onChange={(e) => setText(e.target.value)}
              />
              <button type="submit" className="admin-btn" disabled={!text.trim() || loading}>
                {loading ? "Ingesting..." : "Ingest Text"}
              </button>
            </form>
          </section>
        </div>
      </div>
    </div>
  );
}
