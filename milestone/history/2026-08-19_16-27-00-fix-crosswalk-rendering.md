# Fix crosswalk rendering

- Changed zebra crossings to render explicitly where the roadbed stencil equals 1.
- Disabled depth testing/writing for the painted markings so the raised sidewalk and asphalt depth buffers cannot hide them.
- Increased the paint color slightly while retaining a warm, muted Apple Maps-style white.
- Recorded that time-of-day lighting is not implemented yet.
