# Stern facing southwest

- Corrected the direction-language mismatch in Stern's preset.
- Rotated Stern exactly 90 degrees toward the south from the prior northwest-facing view, setting its azimuth to `Math.PI / 2 + 0.42`.
- Preserved Stern's target, `2.41x` zoom, reduced camera elevation, and all other landmark presets.
- Verified with `npm run lint` and `npm run build`; both pass.
