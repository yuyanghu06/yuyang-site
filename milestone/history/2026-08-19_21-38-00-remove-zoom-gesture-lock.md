# Remove zoom gesture lock

- Removed the 260 ms blocked-zoom gesture timer and active-gesture flag.
- Repeated scroll-in events over the same ordinary map position now retrigger the pointer-anchored pulse immediately.
- Preserved the existing 260 ms visual pulse duration and landmark scroll-to-select behavior.
