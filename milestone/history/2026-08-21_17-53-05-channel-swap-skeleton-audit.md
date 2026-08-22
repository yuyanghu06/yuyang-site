# Channel-swap skeleton audit

- Kept the recovered absolute-retarget bind and swapped only paired left/right shoulder-to-fingertip animation channel targets.
- Produced a separate diagnostic GLB and rendered its complete frame-45 skeleton inside the mesh.
- The x-ray visibly shows crossed shoulder/clavicle chains; simple channel exchange is invalid because corresponding left/right bones use mirrored local axes.
- Rejected the candidate and left the website unchanged.
- The next valid correction must convert rotations between mirrored quaternion bases while retaining the recovered bind.
