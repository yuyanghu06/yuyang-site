# Correct Union landmark addresses

- Corrected the first requested target to BIN `1087304`, the project address-index match for 25 Union Square West.
- Corrected the second requested target to BIN `1017906`, the address-index match for 235–237 Park Avenue South / 101–103 East 19th Street. External confirmation places Union Square Cafe at the southeast corner of Park Avenue South and East 19th Street.
- Restored mistaken BINs `1016075` and `1078701` to ordinary context geometry.
- Regenerated the 186 spatial city tiles. Runtime detail data now contains `1087304` (13 surfaces) and `1017906` (42 surfaces), with neither mistaken BIN included.
- Landmark exit now returns to the active destination's overview, including the Union Square center for Union landmark scroll-out/Escape.
- ESLint, TypeScript, optimized production build, and static prerendering pass.
