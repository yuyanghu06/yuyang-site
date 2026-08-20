# Looping clouds and birds

- Added three modeled, rounded cartoon cloud groups to the live Washington Square scene.
- Added four small modeled birds arranged as two loose pairs, with animated wing flaps and slight vertical drift.
- Clouds and birds travel in staggered overhead lanes at varied speeds, move fully out of bounds, and then wrap back in for continuous cycling.
- Movement uses frame delta time and caps long-frame jumps for stable animation across refresh rates and tab resumes.
- `npm run lint` and `npm run build` both pass.
