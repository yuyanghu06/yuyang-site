# Inline dialogue controls and docked replies

All phase choices and continuation/presentation actions now share the latest assistant bubble with one Reply trigger in both expanded and docked layouts. Removing the old direct children below the transcript also removes their oversized external gap.

The generic expanded Reply branch no longer overlaps choice-specific controls. The chat root also stops keyboard propagation, preventing Enter or Space in the minimized inline composer from activating the avatar shell's fullscreen-open handler.

Targeted ESLint, TypeScript, and `git diff --check` all pass.
