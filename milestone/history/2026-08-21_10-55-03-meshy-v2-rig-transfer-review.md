# Meshy replacement rig-transfer review

- Generated Meshy task `01a0256f-a640-74f0-95af-67e643ca4840` from the approved featureless source using T2 Smart Topology, a 15,000-face target, A-pose output, 4K base color, and no PBR maps.
- The 11,374-vertex/15,341-polygon result retains a subtle generated nose; the user accepted it for a rigging trial.
- Created a temporary, non-production Blender review candidate under `/tmp/yuyang-meshy-smart-topology-review-01a0256f/`.
- Transferred the authoritative V2 54-bone hierarchy, all 30 finger bones, the matching 54 deform groups, and `Yuyang_Talking_Loop_v2` using the old rest-pose mesh as the weight donor.
- All 11,374 candidate vertices are weighted. Five sampled animation frames remain finite and proportionally stable, and frames 1/89 close exactly with a `0.0` maximum bone-matrix delta.
- Opened the rigged candidate in Blender for visual review. Production assets remain unchanged pending approval of the face and hand deformation.
