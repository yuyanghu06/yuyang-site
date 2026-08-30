# Fix Reply across all minimized phases

- Found that the initial choice and declined phase gate could still suppress the inline composer after Reply set composer-open state.
- Moved composer-open precedence above every phase-specific restriction, covering initial choices, declined prompts, destinations, tour stops, and free-dialogue Back states.
- Targeted ESLint and whitespace validation pass.
