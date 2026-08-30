# Chat speaking state and bubbles

- Changed the avatar talking signal so request waiting and model reasoning keep the neutral mouth; talking begins with the first visible non-whitespace response text.
- Kept semantic emotes silent and only resumes mouth motion afterward when response text is already visible.
- Restored visitor messages to the expanded transcript in their original conversation order and aligned them to the right.
- Rendered each rounded bubble and its mirrored lower-corner tail as one continuous SVG path, eliminating the seam from overlapping translucent shapes.
- Targeted ESLint and whitespace validation pass. The broader type check remains blocked by the pre-existing unresolved `@/agent/run-agent` import reported from `src/app/api/agent/route.ts`.
