# Roads-first visual order

- Preserved parallel loading and center-tile warmup.
- Restored strict visual ordering: the complete 1.12-second road spring finishes before any building becomes visible.
- Reduced the post-road handoff to 50 ms; predecoded buildings then begin their radial spring sequence immediately.
