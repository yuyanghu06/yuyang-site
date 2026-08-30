# Revert forced dialogue height

- Removed the temporary per-stream inline height writer from the dialogue renderer.
- Removed the length-based multiline class and nine-rem minimum height.
- Restored intrinsic assistant-card sizing in both expanded and docked modes.
- Retained the scoped mobile wrapping, modal bounds, and requested left inset.
- Targeted ESLint and whitespace checks pass.
