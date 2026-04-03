---
name: chatbot-upgrade
description: Upgrade the portfolio site's AI chatbot to use model-driven context retrieval, streamed tool call status, and an admin ingest page. Use this skill when implementing any of, separating the RAG context layer so the model queries Pinecone via a [retrieve] tool call instead of pre-fetching context from the user query, adding SSE streaming from the NestJS backend to the React frontend to display tool call status bubbles in the chat UI, or building a key-protected /admin/ingest page that uploads PDFs or raw text directly into Pinecone through the NestJS backend. Also trigger when modifying the chat service's tool-use loop, updating the system prompt's tool definitions, wiring up the ContextService or IngestService, or changing how the frontend handles streamed chat responses. Covers the full stack, NestJS backend (chat SSE, context module, ingest module), React frontend (tool status bubbles, admin page, SSE fetch handling), Pinecone integration, and OpenAI embeddings.
---
## Overview

This config covers three interconnected changes to the personal portfolio site:

1. **Separate the context layer** — The chatbot model currently receives RAG context pulled from the user's query. Change this so the model itself decides when and how to query Pinecone by issuing a structured tool call. The NestJS backend orchestrates a tool-use loop: the model requests context via a `[retrieve]` tool, the backend executes the Pinecone query, feeds results back, and the model generates its final response with retrieved context.

2. **Stream tool call status in the chat UI** — Every tool call the model makes (retrieve, navigate, contact, redirect, message) should be visible to the user in real-time as a summarized status message in the chat stream. These appear as distinct "thinking" or "action" bubbles before the final assistant response.

3. **Admin ingest page** — A new `/admin/ingest` route on the site, protected by a static key, that lets you upload PDFs or paste raw text directly into Pinecone through the NestJS backend. This replaces the separate local FastAPI ingest app.

---

## Stack Context

- **Frontend**: React 18 + Vite + TypeScript + Zustand
- **Backend**: NestJS (unified monorepo — do NOT split packages)
- **Inference**: TogetherAI Chat Completions API (`POST https://api.together.xyz/v1/chat/completions`)
- **Vector DB**: Pinecone (`memories` index, 1536 dimensions, cosine distance)
- **Embeddings**: OpenAI `text-embedding-3-small` (1536-dim output)
- **Email**: Resend SDK
- **Deployment**: Railway (custom domain via Namecheap)
- **No UI component libraries** — plain React + CSS

---

## Architecture After Changes

```
┌─────────────────────────────────────────────────────────────────┐
│  React Frontend                                                 │
│  ┌────────────────────┐     ┌──────────────────────┐            │
│  │ ChatWidget          │     │ AdminIngestPage       │            │
│  │  └─ ChatPane        │     │  └─ PDF upload        │            │
│  │     └─ ToolStatus   │     │  └─ Text input        │            │
│  │     └─ ChatMessage  │     │  └─ Key gate          │            │
│  └──────┬─────────────┘     └──────┬───────────────┘            │
│         │ POST /api/chat (SSE)     │ POST /api/ingest/pdf       │
│         │                          │ POST /api/ingest/text      │
│         ▼                          ▼                            │
│  ┌─────────────────────────────────────────────────────┐        │
│  │ NestJS Backend                                      │        │
│  │  ├─ ChatController    → Tool-use loop → TogetherAI  │        │
│  │  │   └─ Pinecone query (on [retrieve] tool call)    │        │
│  │  ├─ ContactController → Resend                      │        │
│  │  └─ IngestController  → Chunk → Embed → Pinecone    │        │
│  └─────────────────────────────────────────────────────┘        │
└─────────────────────────────────────────────────────────────────┘
```

---

## New Environment Variables

Add these to `.env` (some may already exist):

```
PINECONE_API_KEY=
PINECONE_INDEX_NAME=memories
OPENAI_API_KEY=
ADMIN_INGEST_KEY=         # Static secret key for the admin ingest page
```

Existing env vars that should already be set: `TOGETHER_API_KEY`, `TOGETHER_MODEL_ID`, `RESEND_API_KEY`, `CONTACT_EMAIL_TO`.

---

## New File Structure

Add these files into the existing project structure. Do not move or rename existing files.

```
src/
├── server/
│   ├── chat/
│   │   ├── chat.controller.ts       # MODIFY — SSE streaming + tool-use loop
│   │   ├── chat.service.ts          # MODIFY — tool-use orchestration
│   │   └── chat.prompt.ts           # MODIFY — add [retrieve] tool definition
│   ├── context/                     # NEW MODULE
│   │   ├── context.module.ts
│   │   └── context.service.ts       # Pinecone query + OpenAI embedding
│   ├── ingest/                      # NEW MODULE
│   │   ├── ingest.module.ts
│   │   ├── ingest.controller.ts     # POST /api/ingest/pdf, POST /api/ingest/text
│   │   ├── ingest.service.ts        # Chunk → embed → upsert to Pinecone
│   │   └── ingest.guard.ts          # Key-based auth guard
├── client/
│   ├── pages/
│   │   └── AdminIngest.tsx          # NEW — admin ingest page UI
│   ├── components/
│   │   └── chat/
│   │       └── ToolStatusBubble.tsx  # NEW — renders tool call status in chat stream
│   ├── stores/
│   │   └── chatStore.ts             # MODIFY — add toolCalls state + SSE handling
```

---

## Feature 1: Context Layer Separation (Model-Driven Retrieval)

### Concept

Previously, the backend embedded the user query, searched Pinecone, and injected context into the prompt before calling TogetherAI. Now the model decides whether it needs context and explicitly requests it via a `[retrieve]` tool call. This gives the model control over what to search for — it can rephrase the user's query, request multiple retrievals, or skip retrieval entirely for simple conversational turns.

### System Prompt Changes (`chat.prompt.ts`)

Add the `[retrieve]` tool definition to the existing tools section in the system prompt:

```
### [retrieve] <query>
Search your memory for context relevant to a query. Use this whenever a visitor asks about Yuyang's background, projects, experience, interests, skills, or anything factual about him. The query you pass should be a short, focused search phrase — rephrase the visitor's question into the most useful lookup terms. You will receive the retrieved context as a system message, then continue your response.

You can call [retrieve] multiple times if you need context on different topics before answering.

Do NOT use [retrieve] for:
- Simple greetings or conversational turns
- Questions about what you are (you already know your own identity)
- Navigation requests, contact requests, or redirect requests

Example:
User: "What projects has Yuyang worked on?"
Assistant: "Let me pull that up.

[retrieve] Yuyang projects portfolio"

(Context is returned, then you respond with the retrieved information.)
```

### Backend Tool-Use Loop (`chat.service.ts`)

The chat service now implements a **tool-use loop** instead of a single inference call:

```
1. Receive messages array from frontend
2. Prepend system prompt
3. Call TogetherAI Chat Completions (NON-streaming to TogetherAI — streaming happens from backend to frontend via SSE)
4. Parse the assistant response for tool tags:
   a. If [retrieve] <query> is found:
      - Extract the query string
      - Call ContextService.search(query) → get top-k chunks from Pinecone
      - Send an SSE event to frontend: { type: "tool_call", tool: "retrieve", summary: "Searching memory for: <query>" }
      - Append the retrieved context as a system message to the conversation
      - Call TogetherAI again with the updated messages
      - Go back to step 4 (check for more tool calls)
   b. If [navigate], [contact], [redirect], or [message] is found:
      - Send an SSE event to frontend: { type: "tool_call", tool: "<name>", summary: "<human-readable description>" }
      - These are terminal — do NOT loop. Return the final response.
   c. If no tool tag is found:
      - Response is purely conversational. Return it.
5. Send final SSE event: { type: "response", content: "<final assistant message with tool tags stripped>" }
6. Close SSE stream
```

**Max loop iterations**: Cap the tool-use loop at **3 iterations** to prevent infinite loops. If the model keeps issuing [retrieve] calls after 3 rounds, force-return whatever response it has.

**Context injection format**: When feeding retrieved chunks back to the model, append them as a system-role message:

```json
{
  "role": "system",
  "content": "Retrieved context:\n\n<chunk 1 text>\n\n<chunk 2 text>\n\n<chunk 3 text>\n\nUse this context to inform your response. If the context doesn't contain the answer, say you don't know."
}
```

### Context Service (`context.service.ts`)

New NestJS service in a `ContextModule`:

```typescript
// Responsibilities:
// 1. Embed a query string using OpenAI text-embedding-3-small
// 2. Query Pinecone memories index with the embedding, top_k=5
// 3. Return the matched chunk texts as an array of strings

// Dependencies: @pinecone-database/pinecone, openai

// Method signature:
async search(query: string): Promise<string[]>

// Implementation:
// - Create OpenAI embedding: POST https://api.openai.com/v1/embeddings
//   model: "text-embedding-3-small", input: query
// - Query Pinecone: index.namespace('').query({ vector: embedding, topK: 5, includeMetadata: true })
// - Extract metadata.text from each match
// - Return array of text strings
```

### Chat Controller SSE Endpoint (`chat.controller.ts`)

Change `POST /api/chat` to return an **SSE stream** instead of a JSON response:

```typescript
// Use NestJS @Sse() decorator or manual Response streaming
// Content-Type: text/event-stream

// SSE event format:
// event: tool_call
// data: {"type":"tool_call","tool":"retrieve","summary":"Searching memory for: Yuyang projects"}
//
// event: tool_call  
// data: {"type":"tool_call","tool":"navigate","summary":"Navigating to projects page"}
//
// event: response
// data: {"type":"response","content":"Here's what Yuyang has been working on..."}
//
// event: done
// data: {}
```

**Important**: The calls FROM the backend TO TogetherAI are standard request/response (NOT streamed). The streaming is only from the NestJS backend to the React frontend via SSE, so the backend can emit tool_call events in between inference rounds.

---

## Feature 2: Tool Call Status Display in Chat UI

### Frontend SSE Handling (`chatStore.ts`)

Modify the Zustand store and `sendMessage` action:

```typescript
interface ToolCall {
  id: string;          // unique ID for React key
  tool: string;        // "retrieve" | "navigate" | "contact" | "redirect" | "message"
  summary: string;     // human-readable description
  timestamp: number;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  toolCalls?: ToolCall[];   // tool calls that preceded this message
}

// In sendMessage:
// 1. Append user message to state
// 2. Create an EventSource or fetch with ReadableStream to POST /api/chat
// 3. As SSE events arrive:
//    - "tool_call" events: accumulate into a toolCalls array, update state so UI renders them immediately
//    - "response" event: create the assistant message with the accumulated toolCalls attached
//    - "done" event: close the stream, set isLoading = false
// 4. Parse action tags from the final response content (navigate, contact, redirect, message) on the frontend as before
```

**SSE with POST**: The standard `EventSource` API only supports GET. Use `fetch` with a `ReadableStream` reader instead:

```typescript
const res = await fetch('/api/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ messages }),
});

const reader = res.body!.getReader();
const decoder = new TextDecoder();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  const chunk = decoder.decode(value);
  // Parse SSE lines from chunk (split on \n\n, extract "data:" lines)
  // Route to appropriate handler based on event type
}
```

### ToolStatusBubble Component (`ToolStatusBubble.tsx`)

A small, visually distinct component that renders inline in the chat message list to show each tool call:

```
Design:
- Appears ABOVE the assistant message it's associated with
- Compact — single line, muted styling
- Icon or indicator on the left (e.g., a small dot, spinner while in-progress, checkmark when done)
- Text is the summary field from the tool_call event
- Examples of what the user sees:
  "🔍 Searching memory for: Yuyang's projects"
  "📄 Navigating to projects page"
  "✉️ Opening contact flow"
  "🔗 Opening GitHub"
- Use the site's muted/secondary text color — these should feel like metadata, not primary content
- No emoji if the site design doesn't use them — use subtle CSS indicators instead (pulsing dot, etc.)
```

### Rendering Order in ChatPane

For each assistant message, render its associated tool calls first, then the message itself:

```
[User bubble: "What projects has Yuyang worked on?"]
[ToolStatusBubble: "Searching memory for: Yuyang projects"]     ← appears during SSE stream
[Assistant bubble: "Here's what I've been working on..."]        ← appears after stream completes
```

If multiple tool calls happen in one turn (e.g., two [retrieve] calls), show them in sequence:

```
[User bubble: "Tell me about Journey and your site's tech stack"]
[ToolStatusBubble: "Searching memory for: Journey iOS app"]
[ToolStatusBubble: "Searching memory for: portfolio site tech stack"]
[Assistant bubble: "Journey is an AI-powered journaling app..."]
```

---

## Feature 3: Admin Ingest Page

### Route: `/admin/ingest`

A new React page accessible at `/admin/ingest`. This page is NOT linked from the site navigation — it's only accessible by direct URL.

### Key Gate

When the page loads, it shows a single text input asking for an access key. The user enters the key and clicks "Unlock." The frontend sends the key with every subsequent API request in an `x-admin-key` header. The backend validates it against the `ADMIN_INGEST_KEY` env var.

**Do NOT use sessions, cookies, JWTs, or any auth library.** Just a static key comparison on every request. Store the key in Zustand or React state for the duration of the session — it resets on page refresh.

### Page UI (after unlock)

Two input modes on the same page:

**Mode 1: PDF Upload**
- File input that accepts `.pdf` files
- On submit, sends the file as `multipart/form-data` to `POST /api/ingest/pdf`
- Shows upload progress and success/error status

**Mode 2: Text Input**
- A textarea for pasting or typing raw text
- Optional "source label" text input (e.g., "bio", "project notes") — stored as metadata
- On submit, sends JSON to `POST /api/ingest/text`
- Shows success/error status

Both modes show a confirmation with the number of chunks created and upserted.

### Backend: Ingest Module

#### `ingest.guard.ts`

A NestJS guard that reads the `x-admin-key` header and compares it against `process.env.ADMIN_INGEST_KEY`. Returns 401 if missing or mismatched.

Apply this guard to all ingest controller routes.

#### `ingest.controller.ts`

```
POST /api/ingest/pdf
- Accepts: multipart/form-data with a single PDF file
- Protected by IngestGuard
- Passes file buffer to IngestService.ingestPdf()
- Returns: { success: true, chunksCreated: number }

POST /api/ingest/text
- Accepts: JSON { text: string, source?: string }
- Protected by IngestGuard
- Passes text to IngestService.ingestText()
- Returns: { success: true, chunksCreated: number }
```

#### `ingest.service.ts`

Handles the full ingest pipeline:

```
1. PARSE (PDF only)
   - Use pdfplumber or pdf-parse to extract text from PDF buffer
   - npm package: "pdf-parse" (lightweight, works in Node)

2. CHUNK
   - Use LangChain's RecursiveCharacterTextSplitter
   - npm package: "langchain" (or "@langchain/textsplitters" if available as standalone)
   - Settings: chunkSize=500, chunkOverlap=50
   - Split on: ["\n\n", "\n", " ", ""]

3. EMBED
   - Call OpenAI embeddings API for each chunk
   - Model: text-embedding-3-small
   - Batch chunks to minimize API calls (OpenAI supports batch embedding)
   - npm package: "openai"

4. UPSERT
   - Upsert vectors to Pinecone memories index
   - Each vector:
     - id: generate a unique ID (e.g., uuid or hash of content)
     - values: the embedding array
     - metadata: { text: <chunk text>, source: <filename or source label or "manual">, timestamp: <ISO string> }
   - npm package: "@pinecone-database/pinecone"
```

### Dependencies to Install

```bash
npm install pdf-parse @pinecone-database/pinecone openai langchain @langchain/core
```

If `@langchain/textsplitters` exists as a standalone package, prefer that over the full `langchain` package to keep bundle size down.

---

## Updated System Prompt

The full updated system prompt should be stored in `chat.prompt.ts`. Here is the complete tool section to replace the existing one (the persona, voice, few-shot examples, and rules sections remain unchanged):

```
## Tools

You have five tools. To use a tool, output the tag on its own line at the END of your response. Only use one tool per response. If you need context before answering, use [retrieve] FIRST, then answer with the retrieved information on the next turn.

### [retrieve] <query>
Search your memory for context relevant to a query. Use this whenever a visitor asks about Yuyang's background, projects, experience, interests, skills, education, or anything factual about him. Rephrase the visitor's question into focused search terms.

You will receive the retrieved context as a system message and can then respond using it.

When to use: Any factual question about Yuyang that you can't answer from the conversation alone.
When NOT to use: Greetings, identity questions about yourself, navigation/contact/redirect requests.

Example:
User: "What projects has Yuyang worked on?"
Assistant: "Let me look that up.

[retrieve] Yuyang projects portfolio work"

### [navigate] <page>
Navigate the visitor to a page on the site.
Valid pages: home, about, projects, contact

### [contact]
Initiate the contact flow. The frontend handles collecting email and message.

### [redirect] <key>
Open an external link in a new tab. Use the predefined keys only.

### [message]
Default fallback — pure conversational response, no action taken.
```

---

## Absolute Rules

1. **Do NOT split the monorepo.** All new files go into the existing unified package structure.
2. **Do NOT install a UI component library.** Build everything with plain React + CSS.
3. **Do NOT persist chat history** to a database. Messages live in Zustand and reset on refresh.
4. **Do NOT hardcode API keys.** All secrets come from environment variables.
5. **Do NOT stream FROM TogetherAI.** The backend makes standard request/response calls to TogetherAI. The SSE stream is only from the NestJS backend to the React frontend.
6. **Action tags are parsed on the frontend** (navigate, contact, redirect, message). The backend only parses `[retrieve]` to execute the tool-use loop.
7. **The contact flow state machine lives entirely on the frontend.**
8. **The admin ingest page uses NO auth library** — just a static key in a header compared against an env var.
9. **Cap the tool-use loop at 3 iterations.** If the model issues more than 3 [retrieve] calls in a single turn, force-return the current response.
10. **The [retrieve] tool is backend-only.** Its tag is never forwarded to the frontend. The frontend never sees `[retrieve]` — it only sees the `tool_call` SSE events and the final response.
11. **Ingest pipeline runs in NestJS** — do NOT create a separate FastAPI app. The existing separate FastAPI ingest app is being replaced by this.
12. **Run `npm run build` and verify no TypeScript errors** before considering any task complete.