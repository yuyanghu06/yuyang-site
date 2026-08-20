# Stern camera 90 degrees west

- Rotated Stern's selected camera position 90 degrees west around the complex, from southwest to northwest, looking southeast.
- Stored the preset as the equivalent short-path angle `-Math.PI / 2 + 0.42` to prevent a long interpolation around the scene.
- Preserved the `2.41x` selected zoom and every other landmark preset.
- Verified with `npm run lint` and `npm run build`; both pass.
