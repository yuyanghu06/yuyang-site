# Merged interactive landmark geometry

- Corrected the selectable identities: Courant is BIN `1008627`; the two-building Stern target combines white BIN `1078952` and red BIN `1077346`.
- Baked each target's CityGML base surfaces, windows, rooftop equipment, and Stern rotunda additions into one vertex-colored mesh before selection, outlining, or animation.
- Rebuilt city tiles with those interactive BINs omitted so lifting cannot reveal a duplicate baked background building.
- Removed the unwanted generated window grid from unrelated BIN `1008629`.
- Replaced per-surface edge tracing with one outer bounding-box edge outline and increased hover/selected lifts to 4.5/9 scene units.
- Added a permanent `AGENTS.md` rule requiring future LOD additions to be merged with their base building before interaction.
- `npm run lint` and `npm run build` pass.
