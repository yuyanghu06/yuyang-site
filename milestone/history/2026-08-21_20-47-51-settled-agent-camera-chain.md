# Settled agent camera chain

- Pending landmark navigation now waits until the current geographic camera interpolation has fully settled before selecting the landmark.
- A Bobst request from the globe therefore completes Globe → Manhattan → Washington Square → Bobst; equivalent cross-level requests preserve their own geographic hierarchy.
- Targeted ESLint, `npx tsc --noEmit`, and `git diff --check` pass.
