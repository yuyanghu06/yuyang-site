# Neutral Avatar Video Prototype

- Completed the selected avatar's Meshy auto-rig for 5 credits and downloaded `public/models/yuyang-avatar-rigged.glb`.
- Confirmed the rig has a 24-bone body skeleton but no jaw bone, facial bones with vertex weights, or morph targets; facial speech therefore requires a custom reusable layer.
- Tested Meshy's stock Idle animation for 3 credits and rejected its pronounced crouching/sideways body motion as the neutral guide state.
- Corrected an unsuccessful direct arm-axis pose that had pulled the hands into the hips. The working scene now isolates Meshy Idle frame one's arm transforms over a straight body, keeps both hands outside the thighs, neutralizes both wrists, and locks the arms for the loop.
- Added a restrained four-second neutral body loop and a provisional custom `Mouth_Open` speech morph/action.
- Rendered 120-frame PNG sequences in Blender and encoded two 512×512, 30 fps, four-second H.264 review videos with system FFmpeg: `yuyang-avatar-neutral-silent.mp4` and `yuyang-avatar-neutral-talking.mp4`.
- Recorded the ten-state layered avatar architecture in `docs/avatar-animation-system.md`. The first neutral pair is an explicit quality gate before producing the other nine states.
