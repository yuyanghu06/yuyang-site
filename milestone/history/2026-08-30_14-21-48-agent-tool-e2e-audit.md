# Agent tool end-to-end audit

An independent sub-agent and the primary agent tested all four model tools against the unified strict JSON schema and live API.

- Navigation emitted the validated `bobst-library` command and a future-tense response.
- Avatar emotes emitted the validated `wave_hello` command before response text.
- Pinecone retrieval showed `Thinking → Remembering → Thinking`, grounded exact-person and multi-turn follow-up answers, returned uncertainty for missing knowledge, bypassed retrieval for base facts, and exposed no internal evidence or metadata.
- Hyperlink lookup returned the exact approved URLs for individual and organization requests. A six-link request initially exhausted the six-round cap; the bounded cap was raised to ten, and a fresh production retest returned all six approved links successfully.
- Runtime argument parsers now reject extra properties independently of the strict Responses API schemas.
- Invalid API camera input returned HTTP 400. Tool and link/camera registry enums were checked for exact equality.
- Targeted ESLint, TypeScript, schema checks, and two fresh production builds passed.
