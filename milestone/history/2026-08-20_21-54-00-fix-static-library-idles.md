# Fix static Quaternius idle retargets

- User review correctly identified that both first comparison MP4s were static.
- Root cause: the retarget script hid the source armature before sampling, which stopped Blender from evaluating its action poses.
- Keeping the source armature dependency-graph visible exposed a second invalid pass: absolute source rotations carried the library's incompatible rest stance into the avatar, raising its arms and crossing its legs. That pass was rejected during contact-sheet review.
- Corrected the retarget to transfer per-bone motion deltas relative to each source clip's first frame onto the avatar's approved neutral, arms-at-sides pose.
- Added automated validation that rejects static target Actions and verifies exact loop closure before export or rendering.
- Regenerated the two comparison MP4s, combined Blender file, and combined two-Action GLB in place.
- Corrected motion deltas are `5.224327` for `Idle_Loop` and `4.616305` for `Idle_Talking_Loop`; both loop-boundary deltas are exactly `0.0`.
