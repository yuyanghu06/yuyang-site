# Remove agent presentation tools

Removed the `display_blue` and `display_white` function tools, command variants, parser branches, model instructions, and terminal tool-loop handling. Agent responses now stream in full, while the existing browser renderer owns 170-character segmentation, queued Next captions, and the final Cancel action.

Targeted ESLint and TypeScript verification passed for the affected agent and caption-renderer files.
