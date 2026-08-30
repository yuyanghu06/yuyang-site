# App Router entry

Docked-caption styles in `globals.css` place dialogue to the right of a left-docked avatar, to the left of a right-docked avatar, and align it with the avatar's bottom edge at either lower corner. Past transcript messages remain hidden for the entire docked lifecycle, including caption fade transitions.

This directory owns the root App Router layout, page, metadata/icon, global CSS, and API routes. The root page mounts the browser-only map shell.

## Direct subfolders

- `api/` contains public backend-for-frontend route handlers, including the server-only agent boundary.
- `avatar-emote-preview/` contains an isolated test page for the candidate restrained nod/open-smile and head-shake/disappointed-face animations plus a flatter texture-dominant 2D rendering treatment; it does not alter the production home route.

## Direct files

- `info.md` documents this folder.
- `globals.css` defines global map, avatar-call, and responsive presentation styles, including the centered expanded modal with bounded dimensions, dynamic viewport-height sizing, safe mobile insets, responsive dialogue placement, and the minimized tile's nearest-corner drag interaction. The minimized tile is re-clamped after viewport changes and uses the Washington development branch's approved 59% horizontal portrait crop.
- `icon.png` is the transparent illustrated application icon.
- `layout.tsx` defines metadata, viewport settings, asset preloading, and the document shell.
- `page.tsx` mounts the map shell for the home route.

Before changing App Router conventions, read the relevant installed Next.js documentation under `node_modules/next/dist/docs/`. `globals.css` includes the FaceTime shell's original responsive dimensions and vertically centered placement, stable 12 px CSS backdrop-blur surface with a localized golden camera-light highlight, overscanned avatar canvas, expanded avatar placement, and the minimized tile's nearest-corner drag interaction, responsive edge spacing, and separately tuned crop.
