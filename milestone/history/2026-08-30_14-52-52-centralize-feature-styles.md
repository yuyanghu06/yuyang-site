# Centralize feature styles

- Moved every stylesheet, including the global base, into the new documented `src/styles/` folder.
- Split the former 1,343-line global stylesheet into focused global, social-link, map-shell, world-loader, avatar-call, and agent-chat files loaded by their owners.
- Reduced the true global base to 50 lines and separated the avatar shell from the chat presentation.
- Defined the dark liquid-glass surface once globally and applied it to assistant bubbles and existing liquid-glass controls, removing duplicated chat declarations.
- Verified all CSS with PostCSS parsing, targeted ESLint, full TypeScript checking, and whitespace validation.
