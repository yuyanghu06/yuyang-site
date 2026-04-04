# CLAUDE.md: nature-editorial (Yuyang's Personal Website)

## Project Identity

- **Name:** nature-editorial
- **Type:** Full-stack personal portfolio with an embedded AI chatbot
- **Architecture:** NestJS backend + Vite/React frontend in a single unified package
- **Design aesthetic:** Photography-first editorial magazine. Cinematic, minimal, luxury.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | NestJS v10, Node.js ≥20, TypeScript |
| Frontend | React 18, Vite 5, TypeScript/TSX |
| Styling | Plain CSS (no Tailwind, no Bootstrap, no CSS-in-JS) |
| Routing (FE) | React Router v6 |
| Animation | Framer Motion |
| AI inference | TogetherAI (`POST https://api.together.xyz/v1/chat/completions`) |
| RAG embedding | OpenAI Embeddings API |
| Vector store | Pinecone SDK |
| Web search | Tavily API (`@tavily/core`) |
| Email | Nodemailer (SMTP) |
| Package manager | npm, single `package.json` at repo root |

---

## Scripts

| Command | Action |
|---|---|
| `npm run dev` | Vite dev server + NestJS watch mode (concurrently) |
| `npm run dev:client` | Vite only |
| `npm run dev:server` | NestJS only |
| `npm run build` | Build client then server |
| `npm run build:client` | Vite to `dist/client/` |
| `npm run build:server` | NestJS to `dist/server/` |
| `npm start` | Run compiled production server |
| `npm run ingest` | Run `scripts/ingest.ts` to embed and upload data to Pinecone |

Run `npm run build` and verify zero TypeScript errors before considering any task complete.

---

## File Structure

```
backend/
├── package.json                    # Single package.json for entire project
├── tsconfig.json                   # NestJS/backend TypeScript config
├── tsconfig.client.json            # Frontend TypeScript config
├── vite.config.ts
├── nest-cli.json
├── .env                            # Env vars, do not commit
│
├── public/
│   └── photos/
│       └── BACKGROUND.jpeg         # THE background image, never move or rename
│
├── src/                            # NestJS backend
│   ├── main.ts                     # Bootstrap, static asset serving config
│   ├── app.module.ts
│   ├── app.controller.ts           # Wildcard GET * → serves index.html
│   ├── chat/                       # POST /api/chat: RAG pipeline to TogetherAI
│   ├── contact/                    # POST /api/contact: SMTP email via Nodemailer
│   └── mcp/                        # Embedding, Pinecone, context services
│
├── client/                         # React frontend
│   ├── index.html
│   └── src/
│       ├── main.tsx
│       ├── App.tsx                  # Router + AnimatedRoutes (Framer Motion)
│       ├── config.ts                # Global config: background path, hero text
│       ├── pages/                   # Home, About, Projects, Contact, ChatBot
│       ├── components/              # Navbar, PageWrapper, HeroBg, SliderControls,
│       │                            #   SpotlightButton, ContentBlock, PageTransition
│       ├── context/
│       │   └── ChatContext.tsx      # Chat state and API calls
│       ├── hooks/
│       └── styles/
│           ├── global.css           # :root variables, resets, font imports
│           ├── hero.css             # Landing page: full bleed, blend modes
│           └── interior.css         # Interior pages: blurred bg, frosted glass
│
├── planning/
│   ├── routes.md                    # All implemented API routes (keep up to date)
│   ├── agent.md                     # Chatbot agent architecture spec
│   └── mcp.md
│
└── dist/                            # Build output, gitignored
    ├── client/
    └── server/
```

---

## Hard Rules

- **NEVER** create a separate `package.json` inside `client/` or `src/`
- **NEVER** move or rename `public/photos/BACKGROUND.jpeg`
- **NEVER** import the background image via JS. Always reference it as a static path string (`"/public/photos/BACKGROUND.jpeg"`)
- **NEVER** add a CSS framework (no Tailwind, no Bootstrap, no styled-components)
- **NEVER** add a UI component library. Build all UI with plain React + CSS
- **NEVER** persist chat history to a database. Messages live in `ChatContext` and reset on refresh
- **ALWAYS** use TogetherAI's token-streaming API (`stream: true`). Stream tokens from TogetherAI and forward them over the SSE connection to the React frontend. The SSE event loop is required and must NOT be disabled or removed
- **NEVER** hardcode API keys. All secrets come from environment variables
- **NEVER** put action-tag parsing on the backend. It is always done on the frontend
- All backend code lives in `src/`
- All frontend code lives in `client/`
- All static assets live in `public/`

---

## Routing

### Backend (NestJS)

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/chat` | RAG pipeline: embed → Pinecone → TogetherAI |
| `POST` | `/api/contact` | Send visitor message via SMTP/Nodemailer |
| `GET` | `*` | SPA wildcard, serves `dist/client/index.html` |

All API endpoints must be prefixed with `/api/` to avoid collision with React Router.

### Frontend (React Router v6)

| Path | Component | Background |
|---|---|---|
| `/` | `pages/Home.tsx` | Full-bleed, no blur (hero layout) |
| `/about` | `pages/About.tsx` | `blur(18px) + scale(1.05)` |
| `/projects` | `pages/Projects.tsx` | `blur(18px) + scale(1.05)` |
| `/contact` | `pages/Contact.tsx` | `blur(18px) + scale(1.05)` |

When adding a new page: register it in `App.tsx` (React Router). The NestJS wildcard catches all non-`/api/*` routes automatically, so no changes to `app.controller.ts` are needed.

---

## Background Image Rules

- Source: `public/photos/BACKGROUND.jpeg`
- Served at: `/public/photos/BACKGROUND.jpeg`
- CSS reference via `--bg-image: url("/public/photos/BACKGROUND.jpeg")` in `global.css`
- TS reference via `config.ts` `CONFIG.backgroundImage`

### Blur by Page

| Page | Component | Blur |
|---|---|---|
| `/` (Home) | `HeroBg` | `filter: none` |
| All interior pages | `PageWrapper` | `filter: blur(18px)` + `transform: scale(1.05)` |
| Any modal | inline | `filter: blur(24px)` |

`PageWrapper` applies blur automatically. `HeroBg` never applies blur. No page sets its own blur directly. Always delegate to the component.

---

## Chatbot Agent

The site has an embedded AI assistant powered by TogetherAI with a RAG context layer.

**Pipeline:** User message → OpenAI embedding → Pinecone nearest chunks → context injected into system prompt → TogetherAI completion

**Action tags** (parsed on the frontend only, stripped from displayed messages):

| Tag | Action |
|---|---|
| `[retrieve] <query>` | Search Pinecone knowledge base, loops back in tool-use loop |
| `[web_search] <query>` | Search the web via Tavily, loops back in tool-use loop |
| `[navigate] <page>` | React Router navigate to `/`, `/about`, `/projects`, or `/contact` |
| `[contact]` | Trigger multi-step contact collection flow in frontend state |
| `[redirect] <key>` | Open mapped external URL in new tab |

The contact flow state machine (`idle → collecting_email → collecting_message → sending → done/error`) lives entirely in `ChatContext`. The backend `/api/contact` is a passthrough that receives a formed `{ email, message }` payload and sends it.

---

## CSS Rules

- Changes global to all pages go in `global.css`
- Changes specific to landing/hero go in `hero.css`
- Changes specific to interior pages go in `interior.css`
- No text shadows. Use blend modes on landing, overlay darkness on interior pages
- No solid panels, opaque surfaces, colored CTA buttons, or box outlines on nav
- Navbar is always fully transparent
- Maximum 2 font families: one serif display + one geometric sans

---

## Environment Variables

```env
# Server
PORT=3000

# AI / RAG
TOGETHER_API_KEY=
TOGETHER_MODEL=
OPENAI_API_KEY=
OPENAI_EMBEDDING_MODEL=        # optional
PINECONE_API_KEY=
PINECONE_INDEX=
PINECONE_TOP_K=                # optional
PINECONE_NEIGHBORS=            # optional
MCP_MAX_CONTEXT=               # optional

# Web search
TAVILY_API_KEY=

# Email
RESEND_API_KEY=
RESEND_FROM_EMAIL=     # sender address verified in Resend dashboard
CONTACT_EMAIL=         # recipient address (where messages get delivered)
```

---

## Code Style

- Add detailed comments for all non-trivial logic
- All new API routes added to `planning/routes.md`
- New React pages go in `client/src/pages/`
- New reusable components go in `client/src/components/`
- New backend routes go in `src/` as a new NestJS module + controller
