# Deepen talking-face colors and widen eye spacing

- User review found the straight-on face palette too shallow and requested more distance between the eyes.
- Updated the editable eight-state atlas SVG, shifting each coordinated eye and brow group 14 pixels outward. Pupil-center spacing increases from 164 to 192 atlas pixels in every open/half/closed state.
- Regenerated the true-alpha 2048x1024 atlas PNG from the SVG.
- Added face-only color processing in Blender: saturation `1.45`, value `0.72`, contrast `0.22`, and reduced emission from `0.35` to `0.08`. Skin and body materials are unchanged.
- Regenerated `assets/blender/yuyang-avatar-talking-loop-face-v2.blend` and the 1080x1440 `public/style-references/avatar/yuyang-avatar-talking-loop-face-v2.mp4` in place.
