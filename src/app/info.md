# App Router entry

This directory owns the root App Router layout, page, metadata/icon, global CSS, and API routes. The root page mounts the browser-only map shell.

## Direct subfolders

- `api/` contains public backend-for-frontend route handlers, including the server-only agent boundary.

## Direct files

- `info.md` documents this folder.
- `globals.css` defines global map, avatar-call, and responsive presentation styles, including the production-only solid-white animated-globe loader, the widened FaceTime-caption history, animated pending dots, its matched two-rem top/bottom boundary inset and five-rem left inset, tour-choice controls that reuse the avatar shell's liquid-glass treatment, the all-white Manhattan neighborhood choices, Yes-sized blue in-bubble tour continuation controls with vertically centered adjacent Reply actions, tightened standalone Reply top spacing for balanced caption-card whitespace, the latest caption's shortened inline reply field with a blue send arrow and visually matched compact blue Cancel text action, and a right-edge-aligned minimized caption positioned to the left of the docked avatar that persists after streaming until explicit dismissal.
- `icon.png` is the transparent illustrated application icon.
- `layout.tsx` defines metadata, viewport settings, asset preloading, and the document shell.
- `page.tsx` mounts the map shell for the home route.

Before changing App Router conventions, read the relevant installed Next.js documentation under `node_modules/next/dist/docs/`. `globals.css` includes the FaceTime shell's original responsive dimensions and vertically centered placement, stable 12 px CSS backdrop-blur surface with a localized golden camera-light highlight, overscanned avatar canvas, expanded avatar placement, and the minimized tile's nearest-corner drag interaction, responsive edge spacing, and separately tuned crop.
