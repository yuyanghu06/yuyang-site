# Remove dialogue auto-segmentation

- Removed the character-count splitter from the dialogue renderer.
- Authored scripts and streamed model answers now render as one complete message with no generated overflow queue or overflow Next controls.
- Kept 120 characters only as system-prompt and dialogue-authoring guidance for punctuation and paragraph rhythm.
- Preserved blue Next and gray Back controls that explicitly navigate between authored guided-tour locations.
- Targeted ESLint, full TypeScript, and whitespace validation pass.
