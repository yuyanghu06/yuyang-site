# Session handoff: full-rate camera transitions

- Removed the explicit 30 FPS throttle while a camera transition, drag, or blocked-zoom pulse is active.
- Manhattan-to-neighborhood and return flights can now render at the display's available `requestAnimationFrame` rate, typically 60 FPS, while idle ambient rendering remains capped at 30 FPS for efficiency.
- ESLint, TypeScript, and diff whitespace checks pass.
