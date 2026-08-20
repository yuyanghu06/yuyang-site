# Tight landmark shell outlines

- Removed world-axis `BoxHelper` outlines, which produced oversized boxes and screen-crossing diagonals around rotated or stepped landmarks.
- Extracted high-angle edges exclusively from each authoritative base-building shell before procedural details are merged.
- Attached the prepared edge geometry to the final merged selectable mesh so outlines hug and lift with Bobst, Courant, and the grouped Stern pair without tracing windows or rooftop details.
- `npm run lint` and `npm run build` pass.
