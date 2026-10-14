# Repository guide

The original `backend/` folder is the active development checkout on `dev`. The separate `backend-dev` worktree has been retired; switch branches in this original folder unless another checkout is explicitly requested.

This is a Next.js App Router site centered on one persistent Three.js experience that moves from a globe to Manhattan or San Diego and then to neighborhood and landmark views.

The server-side portfolio guide uses the official `openai` and `@pinecone-database/pinecone` packages with the OpenAI Responses API. It answers authoritative base facts directly and invokes a private, server-executed Pinecone hybrid-retrieval tool only for personal questions that require additional knowledge. Agent code lives under `src/agent/`, and its public boundary is `src/app/api/agent/`.

- Read `AGENTS.md` before making changes and `milestone/current.md` at session startup. `AGENTS.md` defines the default orchestrator workflow with delegated planning, scoped coding workers, independent evaluation, and integration. `.codex/config.toml` enables subagents, and `.codex/agents/` contains reusable role configurations. `AGENTS.md` also defines the canonical Google-Doc-to-temporary-corpus-to-Pinecone workflow and metadata contract for adding RAG knowledge safely.
- `.codex/skills/pinecone-memory/` packages that memory workflow as a reusable repository skill with destructive-target confirmation and live retrieval verification gates.
- Read the installed Next.js guide under `node_modules/next/dist/docs/` before changing framework code.
- `next.config.ts` configures the shared Markdown-to-string loader for both Turbopack and webpack and assigns immutable caching to versioned runtime animation GLBs. For a temporary tunnel preview, start development with `NEXT_DEV_ALLOWED_ORIGIN=<exact-tunnel-hostname> npm run dev -- --hostname 127.0.0.1`; use only the hostname, without a scheme, path, or wildcard. This enables that host's development assets and hot reload. When unset, no additional development origins are allowed; no tunnel hostname is stored in the config.
- Run targeted checks while iterating. Run the full production build before committing.
- Authored JavaScript and TypeScript files are protected by ESLint's `max-lines` rule; generated source is excluded.
- `tsconfig.json` and `eslint.config.mjs` exclude ignored `data/work/` and `data/raw/` sources from application checks. The local upstream Map3D checkout lives at `data/work/map3d/`; it is used to generate San Diego assets and is never bundled or committed.
- Do not edit generated map data or web exports when an authoring source or build script exists.
- The FaceTime shell uses a lightweight native CSS backdrop blur; avoid reintroducing full-surface SVG displacement filters without memory and transition profiling.
- The live avatar idle is `public/animations/idle.glb`; its manually approved face is embedded and Head-locked in the GLB rather than synthesized by the browser.
- `package.json` defines dependencies and development, build and memory/data commands. Both the original San Diego people/car generators and the separate regional generator are retained; regenerate the region after any original-model update.
- `TODO.md` tracks deferred project work, including the future view-aware ambient sound and background-music system.

## Direct subfolders

- `.codex/` contains project agent configuration, specialist roles, and project skills.
- `assets/` contains editable authoring sources.
- `data/` holds ignored downloads, checkouts, intermediates, and recovery archives.
- `docs/` contains longer technical contracts and workflows.
- `milestone/` holds the current project state and append-only session history.
- `public/` contains browser-served models, data, animation, audio, and reference assets.
- `scripts/` contains repeatable data conversion and asset authoring utilities.
- `src/` contains the Next.js application, conversational agent, styles, and runtime scenes.
- `node_modules/`, `.next/`, and `.git/` are local dependency, build, and version-control directories rather than authored project sources.

## Direct files

- `AGENTS.md` defines project work, documentation, data, and asset rules.
- `.gitignore` excludes generated build products, local environment files, downloads, and working checkouts.
- `.env.example` documents required environment variable names; local `.env` files supply ignored credentials and settings.
- `eslint.config.mjs` configures code-quality checks and excludes ignored third-party working sources.
- `next-env.d.ts` is Next.js's generated ambient type entry point.
- `package-lock.json` pins npm dependency resolution.
- `tsconfig.tsbuildinfo` is the TypeScript incremental cache.
- `info.md` is this repository guide.
