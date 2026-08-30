# Finish free dialogue and prioritize paragraph splits

Authored camera dialogue opened outside the guided tour now queues Next for overflow and ends its final segment with renderer-owned Done. Guided-tour controls remain unchanged. Soft caption splitting now prioritizes paragraph breaks, then single line breaks, then sentence endings or colons.

Targeted ESLint and full TypeScript verification passed.
