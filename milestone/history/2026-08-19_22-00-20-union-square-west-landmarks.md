# Union Square West landmark handoff

- Added BIN `1016075` (27–29 Union Square West) as a merged interactive landmark with tan walls, a muted green authoritative sloped roof, generated dark windows, animated glow, hover lift, and a dedicated lower camera preset.
- Added BIN `1078701` (31 Union Square West) as a separate merged interactive landmark with terracotta/tan surfaces, generated dark windows, and a dedicated taller camera preset.
- Expanded both instanced window sets and baked each building's complete CityGML shell plus windows into one double-sided mesh before interaction.
- Omitted both BINs from background city tiles and regenerated all tile outputs; only the affected spatial GLB changed alongside the runtime data and manifest version.
- Verified runtime detail inclusion (`1016075`: 18 surfaces; `1078701`: 55 surfaces), ESLint, TypeScript, and the optimized production build.
- A browser surface was unavailable for visual QA, so live review of window density, palette balance, and fixed framing remains the next step.
