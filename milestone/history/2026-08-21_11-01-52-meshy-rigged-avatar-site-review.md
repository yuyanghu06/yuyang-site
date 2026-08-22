# Meshy rigged avatar deployed for site review

- Replaced the public idle and talking avatar GLBs with the accepted-for-testing Meshy T2 Smart Topology surface.
- Preserved the existing native idle/talking Action bindings, 54-bone V2 hierarchy, all 30 finger bones, 54 deform groups, and runtime `Head` attachment.
- Both GLBs round-trip cleanly through Blender with the 11,374-vertex/15,341-polygon surface, one intended Action, and a 4096² base-color texture.
- Bumped the idle model cache key to `20260821-meshy-t2-rig-transfer-review`.
- The running development server returns HTTP 200 for the page and the 11,339,060-byte idle GLB; targeted ESLint and whitespace checks pass.
- Browser automation was unavailable, so this remains a live visual-review deployment. The authoritative Blender source is unchanged pending approval.
