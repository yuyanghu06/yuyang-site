# Idle source reference and right-pinky lock

- Locked only the three right-pinky joints to their fitted neutral transforms after user review found localized deformation; all other finger/body delta motion remains.
- Regenerated the embedded idle GLB and numerically confirmed zero motion on each locked right-pinky joint.
- Clarified that the current safe bake transfers source motion deltas onto the Tripo rest pose rather than reproducing the library's absolute idle pose.
- Exported `quaternius-idle-loop-reference.glb` with the untouched source mannequin and only the original three-second idle Action for ordinary-viewer comparison.
- Exact source-pose matching remains dependent on rebinding the avatar to the library's true T-pose skeleton.
