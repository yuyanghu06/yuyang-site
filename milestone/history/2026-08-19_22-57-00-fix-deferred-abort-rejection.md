# Fix deferred abort rejection

- Added immediate normal-abort handling to the deferred planimetrics request.
- Added per-tile abort handling around GLB decode and guaranteed loading-set cleanup with `finally`.
- Normal React teardown and navigation aborts no longer escape as unhandled promise rejections.
- Verified ESLint, TypeScript, and the optimized production build.
