# Talking face v1 preview

- Authored the first deterministic, editable eight-state face atlas in SVG and rasterized it to a verified true-alpha 2048×1024 PNG.
- States are exactly aligned: neutral, half blink, closed blink, small talk, medium talk, wide talk, rounded O, and smiling talk.
- Rendered a 121-frame, 24 fps, 5.04-second full-character timing study over the optimized blank-face review render. The body remains static; mouth shapes hold for four frames and two blinks occur during authored closed-mouth pauses.
- Saved the primary review clip as `public/style-references/avatar/yuyang-avatar-talking-face-2d-v1.mp4` (700×700, 81 KiB), plus a 12 fps GIF and six-frame contact sheet.
- This is intentionally an image-space visual/timing proof. Production remains a live Three.js material/shader atlas on the head's existing UVs so custom website lighting remains active.
