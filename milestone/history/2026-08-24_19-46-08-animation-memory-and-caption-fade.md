# Animation memory and caption fade optimization

- Converted the wave, nod, and disappointed head-shake runtime GLBs from full avatar-scene duplicates into animation-only assets: 12 KiB, 41 KiB, and 41 KiB respectively, down from roughly 5 MiB each.
- Updated the persistent-scene player to rebuild locked body channels from the loaded idle clip while applying only compact moving-channel sources.
- Added immutable one-year caching for versioned `/animations/*.glb` requests and bumped all optimized emote cache keys.
- Fixed minimized-caption completion/Next flicker by retaining dock placement while hidden, committing the blank next caption before reveal, and deferring docked reveal by one animation frame.
- Cleared stale controls at camera-dialogue stream start and made Escape dismiss the caption before minimizing.
- Verified compact GLB structure, ESLint, TypeScript, `git diff --check`, and a successful full Next.js production build.
