# Session handoff: neighborhood-only landmark glow

- Hid every interactive landmark's enchantment glow in the base Manhattan overview.
- Glow is disabled when landmarks register during Manhattan startup, enabled immediately on entry into Washington Square or Union Square, and hidden again on return to Manhattan.
- The landmark building geometry remains visible in all views; only its glow layer changes visibility.
- ESLint, TypeScript, and diff whitespace checks pass.
