# Caption turn limit and presentation pills

- Defined the approved Manhattan caption as the 170-character maximum for every agent turn.
- Added model instructions and a client-side hard split at natural sentence, clause, or word boundaries.
- Queued overflow locally so each blue Next pill reveals one additional caption rather than the complete answer at once.
- Moved terminal presentation controls beneath the message card and changed the final white control to Cancel, which minimizes the guide.
- Verified the affected files with targeted ESLint and full TypeScript checking.
