# App Router entry

Docked-caption styles in `globals.css` place dialogue to the right of a left-docked avatar, to the left of a right-docked avatar, and align it with the avatar's bottom edge at either lower corner.

This directory owns the root App Router layout, page, metadata/icon, global CSS, and API routes. The root page mounts the browser-only map shell.

## Direct subfolders

- `api/` contains public backend-for-frontend route handlers, including the server-only agent boundary.
- `avatar-emote-preview/` contains an isolated test page for the candidate restrained nod/open-smile and head-shake/disappointed-face animations plus a flatter texture-dominant 2D rendering treatment; it does not alter the production home route.

## Direct files

- `info.md` documents this folder.
- `globals.css` defines global map, avatar-call, and responsive presentation styles, including the production-only solid-white animated-globe loader, the widened FaceTime-caption history, animated pending dots, the literally centered expanded modal with its bounded 82.08-rem maximum width and equal left/right margins, rounded clipping, transparent outer call layer without a global filter or fill, its five-rem caption inset, the fullscreen avatar canvas's approved elevated placement and restored horizontal camera offset, the expanded canvas's right-only extension that prevents hand clipping while preserving its left and bottom framing, a 220 ms caption fade enabled only by the shell's post-expansion settled class, tour-choice controls that reuse the avatar shell's liquid-glass treatment, the all-white Manhattan neighborhood choices, consistently Yes-sized blue Next controls in minimized and fullscreen modes with vertically centered adjacent Reply actions, tightened standalone Reply top spacing for balanced caption-card whitespace, the latest caption's shortened inline reply field with a blue send arrow and visually matched compact blue Cancel text action, and a right-edge-aligned minimized caption positioned to the left of the docked avatar whose top-left dismissal × exactly matches the fullscreen close control.
- `icon.png` is the transparent illustrated application icon.
- `layout.tsx` defines metadata, viewport settings, asset preloading, and the document shell.
- `page.tsx` mounts the map shell for the home route.

Before changing App Router conventions, read the relevant installed Next.js documentation under `node_modules/next/dist/docs/`. `globals.css` includes the FaceTime shell's original responsive dimensions and vertically centered placement, stable 12 px CSS backdrop-blur surface with a localized golden camera-light highlight, overscanned avatar canvas, expanded avatar placement, and the minimized tile's nearest-corner drag interaction, responsive edge spacing, and separately tuned crop.
