# Tavily web-search tool

- Added a strict `web_search` function to the unified agent tool collection and kept Responses API tool selection on `auto`, allowing the model to search whenever freshness or external verification is useful.
- Implemented bounded server-side Tavily requests using the existing `TAVILY_API_KEY`, with exact argument validation, a 500-character query ceiling, a 12-second timeout, five-result maximum, and truncated answer/snippet context.
- Updated the base prompt to separate public web search from private Pinecone memory, permit combined use, treat results as untrusted evidence, and link useful sources naturally.
- A live Tavily smoke test returned two results and an answer. Targeted ESLint, full TypeScript validation, and `git diff --check` pass.
