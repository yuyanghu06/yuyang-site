# Markdown dialogue and guided-tour Back

- Moved the global intro and each scripted Manhattan-family camera narration from TypeScript constants into individual Markdown files grouped under `src/components/dialogue/global/`, `manhattan/`, and `union-square/`.
- Added a Markdown-to-string build loader for both Turbopack and webpack; capped segmentation and streaming remain centralized in the dialogue renderer.
- Added cleaned Courant narration covering the double major, Tech@NYU leadership, events, hackathons, and educational partnership programs.
- Added guided-tour-only Back behavior: blue Next is first, gray Back is second, Back walks to the previous current-camera caption before reversing to the previous camera, and no Back appears for direct non-tour dialogue.
- Verified ESLint, TypeScript, `git diff --check`, and an HTTP 200 Turbopack page compile through the existing development server.
