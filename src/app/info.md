# App Router entry

Docked-caption styles in `src/styles/agent-chat.css` place dialogue to the right of a left-docked avatar, to the left of a right-docked avatar, and align it with the avatar's bottom edge at either lower corner. Past transcript messages remain hidden for the entire docked lifecycle, including caption fade transitions.

This directory owns the root App Router layout, page, metadata/icon, and API routes. The root page mounts the browser-only map shell; styles live in `src/styles/`.

## Direct subfolders

- `api/` contains public backend-for-frontend route handlers, including the server-only agent boundary.
- `avatar-emote-preview/` contains an isolated test page for the candidate restrained nod/open-smile and head-shake/disappointed-face animations plus a flatter texture-dominant 2D rendering treatment; it does not alter the production home route.

## Direct files

- `info.md` documents this folder.
- `icon.png` is the transparent illustrated application icon.
- `layout.tsx` defines metadata, viewport settings, asset preloading, the document shell, and imports the global base stylesheet from `src/styles/`.
- `page.tsx` mounts the map shell, imports its social-link presentation from `src/styles/`, and renders fixed external GitHub, LinkedIn, and Instagram profile links as minimal inline SVG logos.

Before changing App Router conventions, read the relevant installed Next.js documentation under `node_modules/next/dist/docs/`. Feature presentation belongs in `src/styles/`; keep this route folder focused on App Router concerns.
