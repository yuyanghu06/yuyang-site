# Require Tavily for live data

- Strengthened the base prompt so every question that requires live or up-to-date data must call `web_search` before the model answers.
- Preserved the existing discretionary search policy for niche, uncertain, externally verifiable, or explicitly requested lookups and the separate Pinecone routing for private personal facts.
