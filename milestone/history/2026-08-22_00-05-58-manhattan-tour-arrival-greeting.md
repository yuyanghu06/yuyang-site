# Manhattan tour arrival greeting

The guided-tour `Yes` branch now continues after the authored Globe → Manhattan flight. The map runtime reports a browser event only when a geographic or landmark camera has fully settled. While the intro is in its one-shot `touring` state, the Manhattan event streams the exact requested welcome beside the minimized avatar:

> Welcome to Manhattan! I'm currently a Junior at NYU, and I spend most of my time split between either Union Square or Washington Square. Where would you like to go first?

The tour state advances to `free` before streaming, preventing later returns to Manhattan from replaying the welcome. The next guided-tour slice is to author the Union Square and Washington Square choice controls and their camera transitions.

Verification completed with targeted ESLint for the changed TypeScript/TSX files and `npx tsc --noEmit`. A full production build was intentionally not run because no commit was requested.
