# Hybrid Meshy body and Tripo hands rig

Tripo's free riggability task `482eb07d-3b64-419c-b09c-b9e0513ba85d` classified the approved surface as a biped. Mixamo-spec rig task `d46ab2d2-015a-4564-a8e0-acc4fcabc073` then produced a 52-bone fitted rig with 30 finger bones and complete vertex coverage.

The hybrid source `assets/blender/yuyang-avatar-hybrid-meshy-body-tripo-hands-review.blend` preserves Meshy task `01a02667-642a-7720-8a81-c96699b37a2d` as the complete 24-bone anatomical body and weight source. Only Tripo's five three-joint digit chains per hand were transformed into Meshy's coordinate system, renamed to the definitive finger convention, parented under Meshy's `LeftHand` and `RightHand`, and blended into the localized hand weighting.

The initial direct Data Transfer attempt was rejected automatically because it overwrote body-group indices and left 23,266 vertices weightless. The corrected process transfers into an isolated topology-identical copy, copies only the digit fields, and never mutates Meshy's original body groups. The resulting GLB has 54 bones, 54 matching groups, zero unweighted vertices, and finite deformation under a simultaneous 30-bone curl test.

Full-body and bilateral hand x-rays are under `public/style-references/avatar/`. The hybrid remains an inspection candidate and has not replaced the authoritative source or deployed avatar.
