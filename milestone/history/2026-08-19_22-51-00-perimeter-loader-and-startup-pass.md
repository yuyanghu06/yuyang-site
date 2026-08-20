# Perimeter loader and startup pass

- Reworked the `NOW BUILDING` indicator into an empty SVG square whose charcoal stroke loads around the perimeter.
- Kept Union Square under the single base-index route through the existing rewrite; no duplicate App Router page was added.
- Reduced eager center-tile warm-up from 24 requests to the first 12-tile decode batch.
- Removed the full planimetrics download/parse and traffic/path construction from the visible road/building critical path.
- Roads now mount and radial building decoding starts while planimetrics resolves in parallel; ambient routes attach afterward.
- Verified ESLint, TypeScript, and the optimized production build.
