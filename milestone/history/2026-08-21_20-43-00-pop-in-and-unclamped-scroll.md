# Caption pop-in and unclamped scroll

- Added a 360 ms opacity, upward-lift, and scale entrance to newly inserted assistant caption cards.
- Removed the scroll clamp and ResizeObserver coordinate rewrites that caused caption clipping and positional jumps.
- New-message insertion now performs one smooth half-previous-card anchor before yielding fully to native scrolling.
