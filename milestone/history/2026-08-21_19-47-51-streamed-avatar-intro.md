# Streamed avatar intro

- Replaced the large traditional chat panel with lightweight visitor and avatar speech bubbles positioned to the avatar's left, including a tail directed toward the character.
- Converted the agent route and client to newline-delimited OpenAI Responses streaming while preserving mandatory Pinecone retrieval, citations, and validated tool commands.
- Added the deterministic first-load sequence: one `wave_hello`, the approved 19-year-old/New York greeting, `Yes`/`No` choices, the `No`/`Okay` minimize path, and the `Yes` Manhattan-navigation path.
- Kept intro state mounted while the call is minimized so the first-load sequence does not restart when reopened.
- TypeScript, targeted ESLint, whitespace validation, and a live streamed RAG/tool request pass. The live response delivered individual text deltas plus Washington Square navigation.
