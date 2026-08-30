# Fix reply action overlap

Prevented retained scripted-tour and choice actions from rendering while an agent reply is pending or has its own renderer-selected Next/Cancel action. This removes the overlapping `Next / Back / Reply` and `Cancel / Reply` rows seen after replying from a guided caption.

Targeted ESLint passed. Repository-wide TypeScript and browser verification were blocked by a separate concurrent retrieval change whose `src/agent/retrieval.ts` imports the currently missing `src/agent/memory-corpus.json`; the local Next.js page shows that unrelated build error.
