# Replace oversized cloud

- Removed the single 3.42-scale cloud that dominated the Manhattan view.
- Added three separate medium cloud formations across the north/south safe bands, bringing the total from seven to nine while improving coverage across the visible band.
- Retained east-to-west motion and fixed-Z clearance from Washington Square and Union Square.
- `npm run lint` passes. The production build currently reaches TypeScript but is blocked by unrelated concurrent waterfront work referencing generated `eastRiver.fdrWays` data that is not yet present.
