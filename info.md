# Repository guide

This is a Next.js App Router site centered on one persistent Three.js experience that moves from a globe to Manhattan and then to neighborhood views.

- Read `AGENTS.md` before making changes and `milestone/current.md` at session startup.
- Read the installed Next.js guide under `node_modules/next/dist/docs/` before changing framework code.
- Run targeted checks while iterating. Run the full production build before committing.
- Authored JavaScript and TypeScript files are protected by ESLint's `max-lines` rule; generated source is excluded.
- Do not edit generated map data or web exports when an authoring source or build script exists.
- `simple-liquid-glass` supplies the FaceTime shell's live-backdrop SVG refraction on Chromium and maintained frosted-glass fallback on Safari and Firefox.
