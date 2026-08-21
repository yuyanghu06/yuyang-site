# Avatar placeholder and backdrop dismissal

- Replaced the blue-green call surface with a warm opaque off-white studio gradient.
- Inserted the existing transparent full-body Meshy preview as a centered static placeholder; no animation asset is used.
- Clicking anywhere outside the modal now triggers the same morph-to-dock behavior as the red close button and Escape.
- Clicks inside the modal are isolated and do not dismiss it.
- Targeted ESLint and TypeScript checks pass.
