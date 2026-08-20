# Smooth empty-map zoom pulse

- Extended the non-landmark scroll-in rejection animation from 300 ms to exactly 1 second.
- Kept the motion as one continuous sine arc: zoom in during the first half, then immediately zoom back out during the second.
- Prevented repeated wheel events within one gesture from continually restarting the animation clock and causing visible stutter.
- Preserved the existing `1.08x` peak and allowed later gestures to trigger a fresh pulse after completion.
