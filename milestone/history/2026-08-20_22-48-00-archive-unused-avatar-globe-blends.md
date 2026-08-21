# Archive unused avatar and globe Blender files

- User requested that only the Blender model currently in use remain active, then selected `data/raw` archival instead of deletion and extended the request to globe sources.
- Kept `assets/blender/yuyang-avatar-talking-loop-face-v2.blend` as the only active avatar Blender source.
- Moved 21 unused avatar `.blend`/`.blend1` files to ignored `data/raw/avatar-blender-archive-2026-08-20/` intact and recoverably.
- Kept `assets/blender/lowpoly-earth-watercolor.blend` as the only active globe Blender source.
- Moved its `.blend1` backup and the obsolete yellow-facet preview `.blend`/`.blend1` pair to ignored `data/raw/globe-blender-archive-2026-08-20/`.
- Left `nyu-custom-buildings.blend` and its backup untouched because they are landmark authoring files, not avatar or globe variants.
- Updated AGENTS and ownership documentation so future work starts from the retained active files and treats the archived predecessors as recovery-only.
