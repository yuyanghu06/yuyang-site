# Gate agent UI on avatar readiness

- Added an avatar renderer callback that fires after loading, shader compilation, and the first rendered frame.
- The call shell now mounts the agent chat only after that callback.
- The first-load wave, greeting stream, Reply action, and Yes/No controls therefore cannot appear or advance before the avatar is visible.
