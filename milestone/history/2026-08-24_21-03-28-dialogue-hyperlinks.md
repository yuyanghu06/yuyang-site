# Dialogue hyperlinks

Dialogue captions now render inline HTTP/HTTPS links authored with standard Markdown `[label](URL)` syntax. Caption segmentation protects each complete link token, typewriter playback reveals only the readable label rather than the Markdown destination syntax, and rendered anchors open in a new tab with `noopener noreferrer`, hover styling, and visible keyboard focus.

The first Tech@NYU mention in `washington-square/courant-institute.md` is the working authoring example and links to `https://techatnyu.org/`.

Targeted verification passed with TypeScript, ESLint for `agent-chat.tsx`, and `git diff --check`. No production build was run.
