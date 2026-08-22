# Caption stack and hidden composer

- Changed automatic caption positioning so the prior assistant message is half-clipped above the fixed top boundary and the newest message occupies the space immediately beneath it.
- Paint-contained filtered caption cards and removed their external shadow to prevent the browser's dark rectangular compositing layer from leaking across the history viewport.
- Hid the freeform `Talk to Yuyang` composer behind a local feature flag while the deterministic scripted tour is being authored; the streaming agent infrastructure remains available for later reactivation.
- Targeted TypeScript, ESLint, and whitespace validation pass.
