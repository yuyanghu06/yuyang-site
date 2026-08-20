# Arrow reference position

- Moved the Washington arrow from `(300, -260)` to `(420, -140)` to place it over the building cluster indicated in the user's second reference image.
- Mirrored the return arrow around the Union Square center at `(125, -440)`.
- Centralized both destination coordinates as named constants so initial load and destination switching cannot drift apart.
- Preserved the dimensional white material, shadows, final spring entrance, scale, height, and orientation.
- ESLint, TypeScript, and `git diff --check` pass. A production build was not rerun because the user's existing Next dev process owns the shared `.next` lock.
