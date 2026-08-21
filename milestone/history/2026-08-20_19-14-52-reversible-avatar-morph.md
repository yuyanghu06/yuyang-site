# Reversible avatar modal morph

- Replaced the approximate center-origin close motion with a measured top-left-origin transform targeting the dock's exact pixel position and dimensions.
- Removed the opacity fade that caused a flicker before the dock appeared.
- Matched the closing endpoint's fill, border, corner geometry, and shadow to the dock.
- Added the reverse interaction: clicking the top-right card now morphs it back into the full modal.
- Targeted ESLint and TypeScript checks pass.
