# Interactive Lipton and reusable landmark skill

- Added only windowed Lipton Hall BIN `1008875` to the interactive landmark pipeline; the adjacent tower remains unselected context.
- Baked Lipton's authoritative CityGML shell and window details into one selectable mesh and omitted its BIN from regenerated background tiles.
- Added Lipton's park-facing, near-top-down selection camera preset and gray bottom/ground color.
- Shortened empty-map scroll-in feedback to an immediate blocked-zoom bounce with no hold.
- Created and validated the reusable global Codex skill `interactive-landmark-zoom` under `/Users/yuyang/.codex/skills/` with geometry integrity, glow, hover, camera, scroll, exit, tile regeneration, and verification guidance.
- Regenerated all 64 city tiles; `npm run lint` and `npm run build` pass.
