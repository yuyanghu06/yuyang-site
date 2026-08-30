# Mobile camera center and caption clipping

- Replaced off-edge mobile canvas translations with a renderer-owned mobile camera center derived from the avatar bounds.
- Preserved the approved desktop right-offset camera and switched centers at the 760 px breakpoint during responsive synchronization.
- Returned mobile canvas transforms to centered `-50%` positioning so the host edge cannot cut through the avatar.
- Disabled mobile assistant-card paint clipping and retained forced wrapping.
- Kept social controls visible during docked conversations; they now hide only while the avatar is expanded.
- Targeted ESLint and whitespace validation pass.
