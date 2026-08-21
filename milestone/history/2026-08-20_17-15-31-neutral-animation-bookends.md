# Neutral Animation Bookends

- Established one canonical `neutral_idle` transition pose for the complete avatar animation set.
- Every loop and one-shot must use that exact pose on its first and last keyed frames, including root, feet, body, hands, gaze, and closed mouth.
- One-shots ease out from and back into the neutral bookends; runtime cross-fades supplement rather than conceal endpoint compatibility.
- Added numerical export validation as a quality requirement so endpoint transform drift fails before integration.
