# Shared avatar fullscreen handoff

- Replaced the interim expanded/docked camera pair with one authoritative full-screen camera so minimizing and restoring only linearly translate and scale the continuously rendered canvas.
- Preserved the user-updated full-screen orthographic height of `0.86`.
- Moved the reusable camera, lighting, face attachment, render loop, and cleanup into `src/components/avatar-view/avatar-fullscreen.tsx`.
- Moved the idle GLB load and fixed-body animation mixer into `src/components/avatar-view/idle/idle.tsx`.
- Added the required `idle/INFO.md` and updated every affected containing-folder guide.
- Reduced the expanded shell's vertical viewport inset to 1.25 rem per side to match the minimized window's edge distance.
- The minimized crop remains intentionally adjustable in CSS; its current values are `translate(-68%, -50%)` and `scale: 0.34`.
- Targeted ESLint, TypeScript, and diff checks pass. Visual browser verification remains unavailable because no browser surface is connected.
