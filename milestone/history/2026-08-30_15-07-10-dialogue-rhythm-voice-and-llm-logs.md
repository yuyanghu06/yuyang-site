# Dialogue rhythm, voice, and LLM logs

- Replaced the viewport-specific caption idea with one 85-character soft target for every screen and improved the splitter to prefer nearby earlier boundaries before falling forward.
- Rewrote every authored camera dialogue in shorter, casual, self-contained beats without em dashes; the longest rendered authored segment is 99 visible characters.
- Added the same response rhythm to the site-agent prompt while allowing answers of any total length.
- Sampled genuine user messages from local Codex sessions scoped to this repository and added ten cadence examples to the prompt, with explicit instructions not to copy typos or abbreviations.
- Added one structured Vercel log per OpenAI Responses round containing only the latest visitor message, the current model output, and minimal identifiers. Full context, prompts, retrieved memory, and earlier turns remain unlogged.
- Targeted ESLint, full TypeScript, segment-length auditing, em-dash auditing, and whitespace validation pass.
