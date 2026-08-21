# Combined talking body and 2D face

- User accepted the corrected talking body/hand loop and requested the previously approved face animation on the complete avatar.
- Added `scripts/avatar/add-talking-face-to-loop-v2.py` and generated `assets/blender/yuyang-avatar-talking-loop-face-v2.blend`.
- Bound the cheek-free eight-state talking atlas to one curved, head-weighted `Yuyang_BlankFace_Canvas`; no DOM or screen-space face overlay is used.
- Authored an 89-frame deterministic schedule with short mouth holds, two closed-mouth blink arcs, and identical neutral facial states at frames 1 and 89.
- Rendered the complete 540x720, 30 fps review to `public/style-references/avatar/yuyang-avatar-talking-loop-face-v2.mp4`. It displays frames 1-88 for a 2.933-second seamless loop without duplicating the terminal frame.
- Initial review found the atlas too close to the hairline and overly affected by lighting. The final canvas is lowered to the facial center and gives the artwork a restrained emission contribution while remaining physically attached to the animated head.
- Blender material-node keyframes are not a portable self-playing glTF animation; the eventual website integration must reproduce the same atlas state selection in WebGL.
