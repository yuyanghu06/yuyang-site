# Repeatable blocked zoom and lower selection pitch

- Replaced the one-shot empty-map zoom destination trick with an independent, restartable 300 ms sine-wave rejection pulse, ensuring every subsequent scroll-in gesture animates.
- Reduced all selected-building camera elevations by 30% while preserving their per-building azimuths and `1.72x` zoom.
- Kept Lipton at its approved western-facing azimuth (`0`) and reduced only its elevation from `390` to `273`.
- Updated and revalidated the reusable `interactive-landmark-zoom` skill to require a restartable rejection animation clock.
- `npm run lint` and `npm run build` pass.
