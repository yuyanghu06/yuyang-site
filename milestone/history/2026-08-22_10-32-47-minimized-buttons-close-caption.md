# Minimized buttons close the caption

Every minimized action pill now uses the shared 180 ms caption-close transition before its action runs. This covers Yes/No, Okay, Manhattan destinations, guided Next, agent continuation Next, and Cancel. Reply remains in place because it edits rather than advances the current bubble.

Queued overflow captions explicitly restore docked visibility after replacing the previous message; streamed responses continue to reveal through the existing streaming lifecycle. Re-closing an already minimized avatar no longer accidentally restores a dismissed bubble.
