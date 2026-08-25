# Avatar emote preview route

This folder owns the isolated `/avatar-emote-preview` test page. It previews candidate avatar emotions without changing the production home page, startup wave, or semantic emote routing.

## Direct subfolders

There are no direct subfolders.

## Direct files

- `page.tsx` exposes the preview route.
- `preview.tsx` loads the production idle avatar, opts into the brighter preview-only flat illustrated renderer, and runs the ten-second neutral, restrained six-degree nod/open-smile, neutral, head-shake/disappointed-face test script. The preview paints a lighter warm-rose open smile with off-white teeth and a soft-coral tongue, while the disappointed state uses a compact light filled frown inside the face canvas's safe mouth band to avoid head-surface clipping.
- `preview.module.css` styles the isolated full-screen preview stage and status label, including the broad low-contrast presentation gradient that replaces geometry-following lighting variation.
- `INFO.md` documents this folder.
