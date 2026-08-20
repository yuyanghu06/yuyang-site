# Synchronized surface reveal

- Kept the initial canvas white while expanded planimetrics downloads, parses, and triangulates.
- Delayed the 220 ms gray-datum fade until the road mesh is actually ready.
- Started the road spring 100 ms after the gray fade begins, removing the long gray-only loading state.
