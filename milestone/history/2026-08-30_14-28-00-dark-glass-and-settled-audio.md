# Dark glass and settled audio controls

- Changed audio and social controls from the light secondary-button surface to the assistant message bubble's dark translucent glass with light SVG foregrounds.
- Added explicit docked-settled state to the avatar shell.
- Kept audio controls hidden throughout the 460 ms minimize transition and faded them in only after the tile settled, preventing them from visibly following the moving avatar.
- Targeted ESLint and whitespace validation pass.
