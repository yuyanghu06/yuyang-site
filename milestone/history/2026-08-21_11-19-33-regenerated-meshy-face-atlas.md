# Regenerated Meshy-head facial atlas

- Abandoned further fitting of the old facial atlas and generated a new cohesive transparent eight-state set specifically for the replacement Meshy T2 head.
- Preserved the untouched 1254² generation source and normalized its four-column/two-row states into a runtime-ready 2048×1024 atlas with eight 512² tiles.
- Ordered the states as neutral, half blink, closed blink, small talk, medium talk, wide talk, rounded talk, and smiling talk.
- Wired the new atlas into the live idle renderer; the current runtime samples its neutral first tile.
- User review found the first regenerated fit too large and high. The current canvas is `0.15 × 0.186` world units centered at X `0`, Y `1.365`.
- Targeted ESLint, whitespace, page HTTP, and atlas HTTP checks pass. Final facial scale and placement remain awaiting visual approval.
