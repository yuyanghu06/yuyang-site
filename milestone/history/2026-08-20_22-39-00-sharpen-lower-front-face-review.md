# Sharpen and reposition combined talking-face review

- User review identified that the combined talking-face MP4 was only 540x720 and that the complete face system sat too high on the head.
- Lowered the entire curved face canvas by `0.035` world units without independently moving any facial features.
- Switched the atlas texture to cubic sampling and doubled the review resolution to 1080x1440.
- Changed the review camera from three-quarter to a straight-on front view at the user's request.
- Regenerated `assets/blender/yuyang-avatar-talking-loop-face-v2.blend` and overwrote `public/style-references/avatar/yuyang-avatar-talking-loop-face-v2.mp4` with the corrected 88-frame, 30 fps, 2.933-second loop.
