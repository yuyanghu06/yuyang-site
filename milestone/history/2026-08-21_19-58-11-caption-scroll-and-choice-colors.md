# Caption scroll and choice colors

- Removed the caption glass perimeter stroke and lightened its dark glass treatment by roughly 20%.
- Assigned semantic choice colors: blue liquid glass for `Yes` and translucent white liquid glass with dark text for `No`; choices retain staggered fade-in.
- Increased vertical spacing between assistant captions and centered the newest caption around the history viewport midpoint while older entries scroll above it.
- Encoded the approved five-rem top whitespace as a fixed caption-history boundary shared with the left inset, so scrolled messages clip below that line.
- Targeted TypeScript, ESLint, and whitespace validation pass.
