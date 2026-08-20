# Overlap first building ring

- Removed the serialized full-road-spring plus 350 ms pause before ordinary buildings.
- Made the first building ring eligible 320 ms after road reveal starts, so road and building springs overlap.
- Warm the nearest 24 spatial GLBs immediately after the 8 KiB manifest arrives, in parallel with heavier runtime/planimetrics/park parsing.
- Preserved radial ordering, solid spring entrances, late-tile immediate reveal, and delayed custom/bird stages.
