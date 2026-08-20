# North-up globe startup alignment

- Changed the initial globe camera distance from the intermediate 1,826-unit framing to the existing 2,400-unit zoom-out ceiling.
- Replaced the shortest-arc NYC-facing rotation with an explicit east/north/outward geographic basis, keeping latitude vertical and longitude horizontal while centering New York toward the camera.
- Kept the imported Earth's verified +210-degree longitude calibration as the shared source for both globe orientation and NYC marker placement.
- Verified with `npm run lint` and `npx tsc --noEmit`.
