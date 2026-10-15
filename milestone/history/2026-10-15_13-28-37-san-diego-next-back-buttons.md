# San Diego Next and Back buttons

Acting role: primary agent, direct implementation at the user's request.

Request: remove the extra San Diego button shown alongside Next and Back, and make Back gray.

Changed `src/components/agent-chat.tsx`: removed the regional shortcut from the shared district/landmark continuation branch and applied `agent-chat__choice--secondary` to Back. Next and the existing inline Reply retain their handlers. The regional chooser and completion controls remain unchanged.

Updated `src/components/info.md`, `milestone/current.md`, `milestone/info.md` and the history index. Existing dialogue restructuring, script edits, departure fade and generated Next change were preserved.

Verification: targeted ESLint and scoped whitespace checks pass. Direct JSX/CSS inspection confirms two navigation buttons and the existing gray secondary styling, including hover. No browser visual review or production build was run. No commit or publication performed.

Result: complete and ready for user review.
