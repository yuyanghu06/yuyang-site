# Nature Editorial — Portfolio Template

A full-stack personal portfolio with an embedded AI chatbot, built with NestJS + React. Photography-first, editorial magazine design aesthetic — cinematic, minimal, luxury.

## Features

- 🎨 **Cinematic design** — full-bleed background image with blur effects on interior pages
- 🤖 **AI chatbot** — RAG-powered conversational assistant with tool use (retrieve, web search, navigate, contact, redirect)
- 📡 **SSE streaming** — real-time token streaming from the AI model to the frontend
- 📧 **Contact form** — SMTP email via Nodemailer
- 📄 **Admin ingest** — upload PDFs, Markdown, or raw text to your knowledge base
- 🔍 **Web search** — Tavily-powered web search for real-time information
- 📱 **Mobile responsive** — adaptive layout with hamburger navigation

## Quick Start

### 1. Install dependencies

```bash
npm install
```

### 2. Add your background image

Place a JPEG image at `public/photos/BACKGROUND.jpeg`. This is the full-screen background used across the entire site.

### 3. Configure environment variables

Copy the example env file and fill in your values:

```bash
cp .env.example .env
```

Required services:
- **[TogetherAI](https://together.ai)** — AI model inference (chat completions)
- **[OpenAI](https://platform.openai.com)** — text embeddings for RAG
- **[Pinecone](https://pinecone.io)** — vector database for knowledge retrieval
- **[Tavily](https://tavily.com)** — web search API
- **SMTP provider** — for the contact form (Gmail, SendGrid, etc.)

### 4. Customize your content

Edit these files to make the site yours:

| File | What to change |
|---|---|
| `client/src/config.ts` | Your name, tagline, social links, featured project, skills, nav links |
| `client/src/pages/About.tsx` | Your about page content blocks |
| `client/src/pages/Projects.tsx` | Your project content blocks |
| `client/src/lib/chatActions.ts` | Your external URLs (GitHub, LinkedIn, project links) |
| `client/src/context/ChatContext.tsx` | Chat greeting message |
| `prompts/SYSTEM_PROMPT.md` | AI persona and voice (this defines how the chatbot behaves) |
| `prompts/TOOLS.md` | Tool descriptions and redirect keys |

### 5. Add knowledge for the chatbot

Place `.md` or `.txt` files in the `knowledge/` directory, then run:

```bash
npm run ingest
```

This embeds your knowledge files and uploads them to Pinecone. The chatbot will use this to answer questions about you.

You can also use the admin ingest page at `/admin/ingest` to upload content through the browser (requires `ADMIN_INGEST_KEY` env var).

### 6. Run locally

```bash
npm run dev
```

This starts both the Vite dev server and NestJS in watch mode. Open `http://localhost:5173`.

### 7. Build for production

```bash
npm run build
npm start
```

## Project Structure

```
├── package.json                    # Single package.json for entire project
├── .env.example                    # Environment variable template
├── public/
│   └── photos/
│       └── BACKGROUND.jpeg         # YOUR background image (required)
│
├── client/                         # React frontend
│   ├── index.html
│   └── src/
│       ├── config.ts               # ★ Main customization file
│       ├── App.tsx                  # Router + layout
│       ├── pages/                  # Home, About, Projects, Contact
│       ├── components/             # Navbar, ChatBot, ContentBlock, etc.
│       ├── context/ChatContext.tsx  # Chat state + SSE streaming
│       ├── lib/chatActions.ts      # URL maps for redirects
│       └── styles/                 # global.css, hero.css, interior.css
│
├── src/                            # NestJS backend
│   ├── main.ts                     # Server bootstrap
│   ├── app.module.ts
│   ├── chat/                       # POST /api/chat — RAG + TogetherAI
│   ├── contact/                    # POST /api/contact — SMTP email
│   ├── mcp/                        # Embedding, Pinecone, Context, Tavily
│   └── ingest/                     # POST /api/ingest/* — admin upload
│
├── prompts/                        # AI system prompts
│   ├── SYSTEM_PROMPT.md            # ★ Chatbot persona and rules
│   ├── TOOLS.md                    # Tool definitions
│   └── IMAGE_ANALYSIS_PROMPT.md    # Image description prompt
│
├── knowledge/                      # Knowledge files for RAG
│   └── example.md                  # Sample — replace with your content
│
└── scripts/
    └── ingest.ts                   # Offline knowledge ingestion script
```

## Deployment

### Railway

The included `railway.toml` is pre-configured for Railway deployment:

```bash
# Install Railway CLI, then:
railway link
railway up
```

Set all environment variables in the Railway dashboard.

### Other platforms

The app runs as a standard Node.js server. Build and start:

```bash
npm run build
npm start
```

The server listens on `PORT` (default: 3000) and serves both the API and the static frontend.

## Architecture

### Chat Pipeline

```
User message
  → OpenAI embedding
  → Pinecone similarity search (auto pre-fetch)
  → Context injected into system prompt
  → TogetherAI completion (streaming)
  → Bracket-tag parsing ([retrieve], [navigate], etc.)
  → SSE events to frontend (token, tool_call, response, done)
```

### Action Tags

The AI model outputs bracket tags that trigger frontend actions:

| Tag | Action |
|---|---|
| `[retrieve] <query>` | Search knowledge base — loops back for another inference |
| `[web_search] <query>` | Search the web via Tavily — loops back |
| `[navigate] <page>` | Navigate to a page (home, about, projects, contact) |
| `[contact]` | Start contact collection flow |
| `[redirect] <key>` | Open external URL in new tab |
| `[message]` | Plain response, no action |

### CSS Design System

- No CSS frameworks — all custom CSS
- Background image with blur variations per page
- Frosted glass effects on interior pages
- Maximum 2 font families: one serif display + one geometric sans
- Fully transparent navbar

## Scripts

| Command | Action |
|---|---|
| `npm run dev` | Vite dev server + NestJS watch mode |
| `npm run dev:client` | Vite only |
| `npm run dev:server` | NestJS only |
| `npm run build` | Build client then server |
| `npm start` | Run compiled production server |
| `npm run ingest` | Embed and upload knowledge to Pinecone |

## License

MIT
