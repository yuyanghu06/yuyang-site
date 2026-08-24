# Remove expanded avatar boundary

- Kept the expanded modal centered at its original bounded dimensions.
- Replaced the transparent outer call layer with the modal's solid gray base color, without adding backdrop blur or filtering.
- Removed the expanded modal shadow and redundant translucent base fill so the rounded clipping edge no longer appears as a boundary against the viewport surface.
- Preserved the localized warm highlight, avatar camera, captions, and docked presentation.
