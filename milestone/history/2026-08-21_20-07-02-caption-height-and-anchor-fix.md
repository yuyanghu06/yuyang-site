# Caption height and anchor fix

- Corrected the half-previous/full-latest scroll anchor to use positions relative to the actual history viewport rather than offset-parent coordinates.
- Expanded invisible scroll room enough for the authored resting offset and removed delayed smooth positioning.
- Prevented caption cards and choice controls from flex-shrinking against that scroll room; this restores their full text height while preserving paint containment.
- Targeted TypeScript, ESLint, and whitespace validation pass.
