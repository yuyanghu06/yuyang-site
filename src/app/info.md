# App Router entry

This directory owns the root App Router layout, page, metadata/icon, and global CSS. The root page mounts the browser-only map shell.

Before changing App Router conventions, read the relevant installed Next.js documentation under `node_modules/next/dist/docs/`. `globals.css` includes the FaceTime shell's original responsive dimensions and vertically centered placement, stable expanded-size liquid-glass surface, 12 px blur-preserving transition placeholder, overscanned avatar canvas, expanded avatar placement, and separately tuned minimized placement; the actual stationary refraction, frost, and backdrop-derived lighting are configured in `src/components/avatar-call.tsx`.
