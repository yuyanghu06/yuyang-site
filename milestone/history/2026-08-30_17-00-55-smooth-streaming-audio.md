# Smooth streaming audio

Completed model answer deltas are now coalesced into one server event. The client buffers the answer and runs it through the same local character reveal used for authored dialogue, keeping caption and blip timing steady when a connection is slow or bursty.

Targeted ESLint and full TypeScript validation pass. No full production build was run because this was an incremental browser-streaming change.
