# Avatar camera light

- Added a warm point light between the avatar camera and subject in the avatar renderer's private Three.js scene.
- Kept the map completely unaffected because the avatar and map use independent scenes and renderers.
- Added a restrained aligned radial highlight to the native CSS liquid-glass surface so the panel visually responds to the same front light.
- Updated the affected folder documentation.
- Verified the touched TypeScript with targeted ESLint and checked the complete diff for whitespace errors; no production build was run under the project's iteration cadence.
