# Enforce scripted caption cap

- Moved scripted-dialogue segmentation into the shared renderer so every scripted caller is hard-limited to 170 characters per caption.
- Updated Bobst's Next behavior to reveal each queued narration segment before continuing past Bobst.
- Verified the change with targeted ESLint, full TypeScript checking, and `git diff --check`.
