# Scene runtime optimization pass

- Optimized the shared Manhattan, Washington Square, and Union Square render runtime without changing scene geometry or interaction behavior.
- Removed per-instance clock reads and temporary up-axis allocation from the 600-pedestrian and 600-vehicle animation loops.
- Capped pointer hover raycasts at the 30 FPS idle presentation rate.
- Removed unnecessary opaque tile-material cloning, indexed tile metadata, and froze static tile transforms after preparation/arrival.
- Deduplicated shared GPU resource disposal during teardown.
- Preserved each procedural landmark as one baked base-plus-detail interaction mesh.
- Verified with `npm run lint`, `npm run build`, and `git diff --check`.
