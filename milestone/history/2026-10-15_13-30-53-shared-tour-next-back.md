# Shared tour Next and Back

Acting role: primary agent, implementing directly per user instruction.

Request: replicate the blue Next / gray Back continuation controls across all tour areas.

Implementation: `src/components/agent-chat.tsx` unifies the New York and San Diego continuation rows and maps all eight New York continuation phases to their existing handlers. Seven San Diego district/landmark phases use their existing stop registry. Intermediate captions use the shared row too, and Next drains queued text before onward travel. Back restores prior caption segments in both cities, then follows the prior-location logic. Back always uses the existing explicit secondary styling. Destination-selection stages and completion menus retain their named actions.

Updated component folder documentation, current milestone and milestone folder guide, plus the history index. Preserved concurrent fullscreen-composer edits in the same component, dialogue restructuring/copy, faster map departure and generated framework changes.

Verification: targeted ESLint passes; full `npx tsc --noEmit --incremental false` passes; scoped whitespace passes; direct JSX/handler review confirms no duplicate generic Next row on tour phases and one inline Reply per continuation row. An initial React refs lint failure was resolved by separating the boolean phase predicate from the event callback lookup. No browser visual review or production build performed.

Result: complete, uncommitted and ready for review. No publication.
