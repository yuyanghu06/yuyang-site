# Session handoff: single base-map zoom pulse

- Fixed the empty-map scroll-in rejection animation restarting for every trackpad momentum event, which could make one gesture appear as two zooms.
- The first negative wheel event now starts the pulse immediately; subsequent events in the same gesture only extend a 140 ms settle window and do not restart it.
- Shortened the pulse from 260 ms to 180 ms to reduce perceived latency.
- ESLint and TypeScript checks pass.
