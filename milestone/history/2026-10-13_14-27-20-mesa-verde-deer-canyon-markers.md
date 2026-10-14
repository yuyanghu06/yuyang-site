# Mesa Verde and Deer Canyon markers

- Role: primary agent, direct implementation and verification as requested.
- Request: add point-of-interest markers for Mesa Verde and Deer Canyon in the San Diego overview.
- Starting state: prior uncommitted label, silent entry, yaw controls, wider/north-shifted overview, and Mesa Verde track were retained.
- Work: generator calculates named POI positions from school-building bounds in OSM parcels `way/61861106` and `way/61861114`; generated manifest exposes them; loader returns definitions; runtime creates matching yellow informational sprites and registers them with existing marker animation/visibility. No new selectable camera/tour destinations or geometry changes.
- Files: generator and guide; manifest and data guide; San Diego loader and guide; map runtime and guide; milestone state/guides and this append-only handoff.
- Checks: targeted ESLint, `npx tsc --noEmit --incremental false`, whitespace validation, named marker metadata inspection, and asset validation. Model hash remains `e533fcc311dd4d9f0c98f22817b4d661215d2b2ab5ddb5d7a396e9d4054bafa9`; source/bounds/counts/landmarks remain unchanged.
- Result: two added overview markers share scale, bobbing, landmark fading, city visibility, and existing cleanup.
- Handoff: continue rapid changes on `backend-dev`; no production build, commit, push, or deployment performed. Earlier feature follow-ups remain in the rolling milestone.
