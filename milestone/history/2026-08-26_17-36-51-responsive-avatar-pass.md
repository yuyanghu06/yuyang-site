# Responsive avatar pass

- Added viewport resize clamping for the minimized avatar tile, including visual viewport changes.
- Switched expanded modal sizing to dynamic viewport height units and reduced the mobile inset from five rem to 0.75 rem.
- Added a `ResizeObserver` to keep the Three.js canvas backing size aligned with its responsive host and raised the pixel-ratio ceiling to 2.
- Increased avatar framing for desktop and mobile readability.
- Verified `npm run lint -- --no-cache` and inspected Chrome at 390×844 and 1920×1080.
