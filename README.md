# Yuyang's Personal Site — Backend

A full-stack personal editorial site built with **NestJS** (server) and **React + Vite** (client), served from a single Node.js process. The site features a photography-first hero layout and a RAG-powered AI chatbot that answers questions about Yuyang by retrieving context from a personal knowledge base stored in Pinecone.

---

## Tech Stack

| Layer     | Technology |
|-----------|------------|
| Backend   | NestJS 10, TypeScript, Node.js ≥ 20 |
| Frontend  | React 18, Vite 5, React Router v6, CSS |
| AI / Chat | TogetherAI (`/v1/chat/completions` + `/v1/embeddings`) |
| RAG index | Pinecone vector database |
| Email     | Nodemailer over SMTP (Gmail) |
| Deploy    | Railway |

---

## Project Structure

```
backend/
├── src/                  # NestJS backend
│   ├── main.ts           # Server bootstrap, static asset config
│   ├── app.module.ts     # Root module
│   ├── app.controller.ts # SPA fallback — serves index.html for all GET *
│   ├── chat/             # POST /api/chat — RAG-augmented chat endpoint
│   ├── contact/          # POST /api/contact — contact form → email
│   └── mcp/              # RAG pipeline (Embedding, Pinecone, Context services)
├── client/               # React frontend
│   └── src/
│       ├── pages/        # Home, About, Projects, Contact
│       ├── components/   # Navbar, ChatBot, PageWrapper, HeroBg, etc.
│       └── styles/       # global.css, hero.css, interior.css
├── knowledge/            # Source documents ingested into Pinecone (fill these in)
├── scripts/
│   └── ingest.ts         # Offline pipeline: chunk → embed → upsert to Pinecone
├── prompts/
│   └── SYSTEM_PROMPT.md  # System prompt prepended to every chat completion
├── public/
│   └── photos/
│       └── BACKGROUND.jpeg
├── .env.example          # Template for all required environment variables
├── railway.toml          # Railway build + start config
└── tsconfig.scripts.json # TypeScript config for running scripts/ingest.ts
```

---

## Environment Variables

Copy `.env.example` to `.env` and fill in all values before running locally.

```bash
cp .env.example .env
```

| Variable            | Required | Description |
|---------------------|----------|-------------|
| `PORT`              | No       | Server port (default: `3000`; Railway sets this automatically) |
| `TOGETHER_API_KEY`  | **Yes**  | TogetherAI API key — [get one here](https://api.together.xyz/settings/api-keys) |
| `TOGETHER_MODEL`    | **Yes**  | Chat model ID on Together (e.g. `Qwen/Qwen2.5-7B-Instruct-Turbo`) |
| `OPENAI_API_KEY`         | **Yes**  | OpenAI API key — [get one here](https://platform.openai.com/api-keys) |
| `OPENAI_EMBEDDING_MODEL` | No       | Embedding model (default: `text-embedding-3-small`; also `text-embedding-3-large`) |
| `PINECONE_API_KEY`  | **Yes**  | Pinecone API key — [get one here](https://app.pinecone.io) |
| `PINECONE_INDEX`    | No       | Pinecone index name (default: `yuyang-knowledge`) |
| `PINECONE_TOP_K`    | No       | Nearest-neighbour chunks to retrieve per query (default: `5`) |
| `PINECONE_NEIGHBORS`| No       | Neighbor expansion window ±N (default: `1`) |
| `MCP_MAX_CONTEXT`   | No       | Max characters of context injected into prompt (default: `2000`) |
| `SMTP_HOST`         | **Yes*** | SMTP server (default: `smtp.gmail.com`) |
| `SMTP_PORT`         | **Yes*** | SMTP port (default: `587`) |
| `SMTP_USER`         | **Yes*** | Gmail address used to send mail |
| `SMTP_PASS`         | **Yes*** | Gmail [app password](https://support.google.com/accounts/answer/185833) |
| `CONTACT_EMAIL`     | **Yes*** | Your inbox — where contact form submissions are delivered |

> \* Required only if you want the contact form to send emails.

---

## Local Development

### Prerequisites
- Node.js ≥ 20
- npm

### First-time setup

```bash
# 1. Install dependencies
npm install

# 2. Copy and fill in environment variables
cp .env.example .env
# Edit .env with your API keys

# 3. (Optional) Populate the Pinecone knowledge index
#    Edit knowledge/bio.md (and any other *.md files you add) with your info, then:
npm run ingest
```

### Running in dev mode

```bash
npm run dev
```

This runs Vite (client, hot-reload) and NestJS watch mode simultaneously via `concurrently`.

| URL | What it serves |
|-----|----------------|
| `http://localhost:5173` | Vite dev server (React, HMR) |
| `http://localhost:3000` | NestJS API endpoints |

API calls from the Vite dev server proxy to NestJS automatically via the `vite.config.ts` proxy configuration.

### Individual processes

```bash
npm run dev:client   # Vite only
npm run dev:server   # NestJS only (watch mode)
```

---

## Knowledge Base Ingestion

The chatbot uses a RAG pipeline to answer questions about you. Source documents live in `knowledge/`. Edit or add `.md` / `.txt` files there, then run:

```bash
npm run ingest
```

This script:
1. Reads all `*.md` and `*.txt` files from `knowledge/`
2. Splits each file into ~300-token overlapping chunks
3. Embeds every chunk via the TogetherAI embeddings endpoint
4. Upserts the vectors + metadata into your Pinecone index

Re-running the script is safe — it overwrites existing vectors by ID.

> **Before ingesting**, create a Pinecone index in the [Pinecone console](https://app.pinecone.io) with the correct vector dimension for your embedding model:
> - `text-embedding-3-small` → **1536** dimensions
> - `text-embedding-3-large` → **3072** dimensions

---

## Production Build

```bash
npm run build
```

This runs `vite build` (outputs to `dist/client/`) then `nest build` (outputs to `dist/server/`). The compiled server serves the React app as static files.

```bash
npm start   # Runs the compiled production server
```

---

## Deploying to Railway

The `railway.toml` at the repo root configures everything:

```toml
[build]
buildCommand = "npm install --include=dev && npm run build"

[deploy]
startCommand = "npm start"
restartPolicyType = "on_failure"
```

### Steps

1. **Push to GitHub** — Railway will detect the repo.
2. **Create a new Railway project** and connect your GitHub repository.
3. **Set environment variables** in the Railway dashboard under *Variables*:
   - Add all keys from `.env.example` (do **not** set `PORT` — Railway injects it).
4. **Deploy** — Railway runs the build command automatically on each push to `main`.
5. **Ingest** — After deploy, run `npm run ingest` locally (it connects to the same Pinecone index). You do not need to run ingest on Railway itself.

### Railway-specific notes
- The server binds to `0.0.0.0` (required for Railway's reverse proxy).
- Railway sets `PORT` automatically — do not hardcode it.
- `devDependencies` are installed during the Railway build because Vite and the NestJS CLI are needed to compile the app; they are not shipped to the final runtime image.

---

## API Reference

### `POST /api/chat`
Accepts a conversation history and returns the AI assistant's reply, augmented with retrieved context from the Pinecone knowledge index.

**Request**
```json
{
  "messages": [
    { "role": "user",      "content": "What projects have you built?" },
    { "role": "assistant", "content": "..." },
    { "role": "user",      "content": "Tell me more about the first one." }
  ]
}
```

**Response**
```json
{ "reply": "..." }
```

---

### `POST /api/contact`
Sends the visitor's message to the configured `CONTACT_EMAIL` inbox via SMTP.

**Request**
```json
{
  "name":    "Jane Smith",
  "email":   "jane@example.com",
  "message": "Hi Yuyang, I'd love to chat!"
}
```

**Response**
```json
{ "ok": true }
```

---

## RAG Pipeline Overview

```
User message
    │
    ▼ EmbeddingService.embed()
Dense query vector (OpenAI /v1/embeddings)
    │
    ▼ PineconeService.queryIndex()
Top-K nearest knowledge chunks + scores
    │
    ▼ ContextService.buildContext()
Neighbor expansion → dedup → format [CONTEXT]...[/CONTEXT]
    │
    ▼ ChatService.chat()
Enriched system prompt + history → TogetherAI /v1/chat/completions
    │
    ▼
{ reply: string }
```

If `PINECONE_API_KEY` is not set, the pipeline is skipped and the chat falls back to the system-prompt-only mode gracefully.
