# Avatar call camera handoff

- Changed the full-screen FaceTime avatar from a centered full-body view to a right-offset waist-up conversational composition.
- Kept the minimized avatar's original centered camera, orthographic scale, and existing CSS `0.75` scale unchanged.
- Passed the expanded/docked presentation state from `avatar-call.tsx` into the Three.js avatar renderer so it selects the appropriate camera preset.
- Updated the containing folder guides for the changed files.
- Targeted ESLint and TypeScript checks pass.
- Visual browser verification remains pending because no browser surface was connected during the session.
