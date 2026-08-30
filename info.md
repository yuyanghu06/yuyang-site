# Repository guide

This is a Next.js App Router site centered on one persistent Three.js experience that moves from a globe to Manhattan and then to neighborhood views.

The server-side portfolio guide uses the official `openai` and `@pinecone-database/pinecone` packages with the OpenAI Responses API. It answers authoritative base facts directly and invokes a private, server-executed Pinecone hybrid-retrieval tool only for personal questions that require additional knowledge. Agent code lives under `src/agent/`, and its public boundary is `src/app/api/agent/`.

- Read `AGENTS.md` before making changes and `milestone/current.md` at session startup. `AGENTS.md` also defines the canonical Google-Doc-to-temporary-corpus-to-Pinecone workflow and metadata contract for adding RAG knowledge safely.
- `.codex/skills/pinecone-memory/` packages that memory workflow as a reusable repository skill with destructive-target confirmation and live retrieval verification gates.
- Read the installed Next.js guide under `node_modules/next/dist/docs/` before changing framework code.
- `next.config.ts` configures the shared Markdown-to-string loader for both Turbopack and webpack and assigns immutable caching to versioned runtime animation GLBs.
- Run targeted checks while iterating. Run the full production build before committing.
- Authored JavaScript and TypeScript files are protected by ESLint's `max-lines` rule; generated source is excluded.
- Do not edit generated map data or web exports when an authoring source or build script exists.
- The FaceTime shell uses a lightweight native CSS backdrop blur; avoid reintroducing full-surface SVG displacement filters without memory and transition profiling.
- The live avatar idle is `public/animations/idle.glb`; its manually approved face is embedded and Head-locked in the GLB rather than synthesized by the browser.
- `package.json` and `package-lock.json` include the VRM runtime plus the official OpenAI and Pinecone server SDKs; `package.json` also exposes the temporary-corpus build and explicitly confirmed replacement-ingestion commands.
- `TODO.md` tracks deferred project work, including the future view-aware ambient sound and background-music system.
