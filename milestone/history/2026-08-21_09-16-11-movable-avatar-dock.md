# Movable avatar dock

- Made the minimized avatar tile draggable with mouse, pen, and touch input.
- Constrained its position to a two-pixel viewport margin.
- Added a movement threshold and click suppression so a completed drag does not reopen the expanded call.
- Kept click and keyboard activation for opening the dock.
- Targeted ESLint and diff validation passed; no production build was run during this interaction iteration.
