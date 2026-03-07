# Yuyang's Personal Site

A full-stack personal portfolio site built with **NestJS** (server) and **React + Vite** (client), served from a single Node.js process. Features a photography-first editorial hero layout, an AI chatbot powered by RAG (Retrieval-Augmented Generation) over a personal knowledge base in Pinecone, and a contact form that delivers email via SMTP. Agentic features are implemented to help the user navigate the site and my various projects, and the AI used is a custom LoRA agent based on Qwen 3 235B finetuned by me on datasets containing my personal messages and documents.  

---

## Tech Stack

| Layer     | Technology |
|-----------|------------|
| Backend   | NestJS 10, TypeScript, Node.js ≥ 20 |
| Frontend  | React 18, Vite 5, React Router v6, CSS |
| AI / Chat | TogetherAI (`/v1/chat/completions`) |
| Embeddings | OpenAI (`/v1/embeddings`) |
| RAG index | Pinecone vector database |
| Email     | Nodemailer over SMTP (Gmail) |
| Deploy    | Railway |

---

## Project Structure

```
backend/
├── src/                    # NestJS backend
│   ├── main.ts             # Server bootstrap — static asset config, CORS, port binding
│   ├── app.module.ts       # Root module
│   ├── app.controller.ts   # SPA fallback — serves index.html for all GET *
│   ├── chat/               # POST /api/chat — RAG-augmented AI chat endpoint
│   ├── contact/            # POST /api/contact — contact form → SMTP email
│   └── mcp/                # RAG pipeline: EmbeddingService, PineconeService, ContextService
├── client/                 # React frontend
│   └── src/
│       ├── pages/          # Home, About, Projects, Contact
│       ├── components/     # Navbar, PageTransition, PageWrapper, HeroBg, ContentBlock, etc.
│       ├── styles/         # global.css, hero.css, interior.css
│       ├── App.tsx         # Router setup, BlurOverlay, animated page transitions
│       └── config.ts       # Global config — background image path, nav links, content
├── knowledge/              # Source documents ingested into Pinecone (*.md / *.txt)
├── scripts/
│   └── ingest.ts           # Offline pipeline: chunk → embed (OpenAI) → upsert to Pinecone
├── prompts/
│   └── SYSTEM_PROMPT.md    # System prompt prepended to every chat completion
├── planning/               # Architecture notes and API reference
├── public/
│   └── photos/             # Static image assets served at /public/photos/
│       └── BACKGROUND.jpeg # Hero background — never moved or renamed
├── .env                    # Local environment variables (not committed)
├── .env.example            # Template for all required environment variables
├── railway.toml            # Railway build + start config
└── tsconfig.scripts.json   # TypeScript config for scripts/ingest.ts
```

---

## Environment Variables

Copy `.env.example` to `.env` and fill in all values before running locally.

```bash
cp .env.example .env
```

| Variable                  | Required   | Description |
|---------------------------|------------|-------------|
| `PORT`                    | No         | Server port (default `3000`; Railway sets this automatically) |
| `TOGETHER_API_KEY`        | **Yes**    | TogetherAI API key — used for chat completions |
| `TOGETHER_MODEL`          | **Yes**    | Chat model ID on Together (e.g. `Qwen/Qwen2.5-7B-Instruct-Turbo`) |
| `OPENAI_API_KEY`          | **Yes**    | OpenAI API key — used for query and document embeddings |
| `OPENAI_EMBEDDING_MODEL`  | No         | Embedding model (default: `text-embedding-3-small`) |
| `PINECONE_API_KEY`        | **Yes**    | Pinecone API key |
| `PINECONE_INDEX`          | No         | Pinecone index name (default: `memories`) |
| `PINECONE_TOP_K`          | No         | Nearest-neighbour chunks to retrieve per query (default: `5`) |
| `PINECONE_NEIGHBORS`      | No         | Neighbor expansion window ±N (default: `1`) |
| `MCP_MAX_CONTEXT`         | No         | Max characters of context injected into prompt (default: `2000`) |
| `SMTP_HOST`               | Yes*       | SMTP server (default: `smtp.gmail.com`) |
| `SMTP_PORT`               | Yes*       | SMTP port (default: `587`) |
| `SMTP_USER`               | Yes*       | Gmail address the server sends mail *from* |
| `SMTP_PASS`               | Yes*       | Gmail [App Password](https://support.google.com/accounts/answer/185833) (not your login password) |
| `CONTACT_EMAIL`           | Yes*       | Your inbox — where contact form submissions are delivered |

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

# 3. (Optional) Populate the Pinecone knowledge index
#    Edit files in knowledge/ with your info, then:
npm run ingest
```

### Running in dev mode

```bash
npm run dev
```

Runs Vite (client, hot-reload on port 5173) and NestJS watch mode (port 3000) in parallel via `concurrently`. The Vite dev server proxies `/api/*` requests to NestJS automatically.

| URL | What it serves |
|-----|----------------|
| `http://localhost:5173` | Vite dev server (React, HMR) |
| `http://localhost:3000` | NestJS (API + static in production) |

### Individual processes

```bash
npm run dev:client   # Vite only
npm run dev:server   # NestJS only (watch mode)
```

---

## Knowledge Base Ingestion

The chatbot uses RAG to answer questions about you. Source documents live in `knowledge/`. Edit or add `.md` / `.txt` files there, then run:

```bash
npm run ingest
```

This script:
1. Reads all `*.md` and `*.txt` files from `knowledge/`
2. Splits each file into overlapping ~300-token chunks
3. Embeds every chunk via the OpenAI embeddings endpoint
4. Upserts the vectors + metadata into your Pinecone index

Re-running is safe — it overwrites existing vectors by ID.

> **Before ingesting**, create a Pinecone index in the [Pinecone console](https://app.pinecone.io) with the correct vector dimension for your embedding model:
> - `text-embedding-3-small` → **1536** dimensions
> - `text-embedding-3-large` → **3072** dimensions

---

## Production Build

```bash
npm run build   # vite build → dist/client/ then nest build → dist/server/
npm start       # Run the compiled production server
```

The compiled server serves the React app as static files and handles all API routes from a single process.

---

## Deploying to Railway

The `railway.toml` at the repo root configures the full build and start:

```toml
[build]
buildCommand = "npm install --include=dev && npm run build"

[deploy]
startCommand = "npm start"
restartPolicyType = "on_failure"
```

### Steps

1. Push to GitHub — Railway detects the repo automatically.
2. Create a Railway project and connect your GitHub repository.
3. Set all environment variables in the Railway dashboard under *Variables* (do **not** set `PORT` — Railway injects it).
4. Deploy — Railway runs the build on every push to `main`.
5. Ingest — Run `npm run ingest` locally after deploy (it connects to the same Pinecone index; no need to run it on Railway).

### Notes
- The server binds to `0.0.0.0` (required for Railway's reverse proxy).
- `devDependencies` are installed during build because Vite and the NestJS CLI are needed to compile; they are not shipped to the runtime image.

---

### Quick reference

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/chat` | RAG-augmented AI chat — returns `{ reply: string }` |
| `POST` | `/api/contact` | Contact form → SMTP email — returns `{ ok: true }` |
| `GET`  | `*` | SPA fallback — serves `index.html` for all non-API routes |

---

## RAG Pipeline Overview

```
User message
    │
    ▼  EmbeddingService  →  OpenAI /v1/embeddings
Dense query vector
    │
    ▼  PineconeService   →  Pinecone similarity search
Top-K nearest knowledge chunks
    │
    ▼  ContextService    →  neighbor expansion + dedup + truncation
[CONTEXT]...[/CONTEXT] block
    │
    ▼  ChatService       →  TogetherAI /v1/chat/completions
{ reply: string }
```

If `PINECONE_API_KEY` is absent (e.g. in early dev), the RAG step is skipped and the chat falls back to system-prompt-only mode without crashing.

## Agentic Tools Overview

The agent has access to the following tools:
1. [navigate]: navigates the user to a seperate section of my site.
2. [contact]: navigates the user specifically to the contact page to allow them to email me. 
3. [redirect]: redirects the user to predefined URLs with a map listed in chatActions.ts to my various projects, social media pages, etc.
4. [message]: default tool for all agentic outputs, no action is done and a message is simply displayed. 