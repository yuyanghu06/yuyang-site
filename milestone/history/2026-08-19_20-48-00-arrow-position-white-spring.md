# Arrow position, white treatment, and final spring

- Moved the Washington navigation arrow 76 world units east and mirrored the return marker around Union Square.
- Kept the extruded/beveled geometry and restored physically lit dimensional shading with a pure-white base, subtle white emissive fill, and cast/received shadows.
- Added a combined rise-and-scale spring entrance lasting 1,120 ms.
- The arrow remains hidden until roads, ordinary buildings, custom landmarks, and birds have entered, then springs in last before resuming its ambient bob.
- Verified with ESLint, TypeScript, a production Next.js build, and `git diff --check`.
