# Use soft caption boundaries

Changed the dialogue renderer's 170-character ceiling into a soft target. Captions now continue through the next sentence ending, colon, or line break before splitting, and text without a later natural break remains intact. Streaming previews and finalized caption queues use the same splitter, preventing dangling list markers and clipped phrases.

Targeted ESLint and full TypeScript verification passed.
