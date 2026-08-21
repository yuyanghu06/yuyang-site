# Idle arms-at-sides correction

- User clarified that the natural idle must keep both arms at the avatar's sides.
- Revised `scripts/create-yuyang-avatar-idle.py` to lower the upper arms another 22° in mirrored local directions and reduced animated upper-arm follow-through to roughly a tenth of a degree.
- Regenerated `assets/blender/yuyang-avatar-idle-v1.blend`, `public/models/yuyang-avatar-idle-v1.glb`, and `public/style-references/avatar/yuyang-avatar-idle-v1.mp4` in place.
- Visual contact-sheet review confirms the arms hang beside the torso and the hands remain alongside the thighs throughout the loop.
- Reverified exact loop closure: frame 1 and frame 121 pose-bone matrices have `0.0` maximum difference.
