# Filter agent commentary from the visitor stream

## Scope

Investigate the reported raw RAG tool-call display using production Vercel logs, repair the leak path, and verify the browser stream.

## Starting state

The agent API exposed only typed NDJSON status, answer, command, completion, and error events, but `run-agent.ts` buffered every OpenAI `response.output_text.delta` without distinguishing assistant message phase.

## Evidence and work performed

- Authenticated Vercel access and queried recent production logs for `/api/agent` LLM turns.
- Reproduced the defect in the logged response to “tell me about yoonchul shin”: a JSON memory-search request appeared as a completed assistant `commentary` message, followed by a separate `final_answer` message.
- Added `extractFinalAnswerText` in `src/agent/runtime/run-agent.ts` and changed the browser boundary to derive text from completed assistant messages while rejecting `commentary` phase items.
- Updated `src/agent/runtime/INFO.md` to document the phase boundary.

## Verification

- Synthetic production-shape regression: commentary JSON plus `Safe answer.` extracted exactly `Safe answer.`.
- `npx tsc --noEmit` passed.
- `npx eslint src/agent/runtime/run-agent.ts` passed.
- A live local POST using “tell me about yoonchul shin” returned safe status events, one final answer text event, and `done`; it contained no raw query arguments or tool payload.
- No full production build was run because this was a targeted iteration and no commit was requested.

## Result and handoff

Raw tool-like commentary is now excluded at the server boundary even when the model fails to encode it as a formal function call. The change is local and has not been deployed.
