# Agent runtime

This folder owns server-side model orchestration and the schemas and validators for agent tools.

## Direct subfolders

There are no direct subfolders.

## Direct files

- `INFO.md` documents this folder.
- `agent_tools.json` defines all model-callable function schemas: map navigation, avatar emotes, private personal-memory search, approved hyperlink lookup, and live public-web search.
- `run-agent.ts` loads the Markdown base prompt, adds live turn context, forces approved hyperlink lookup for explicit profile/link requests, supports enough bounded model/tool rounds to resolve the complete approved link set, and streams Thinking, Remembering, Researching, command, and answer events. Browser-visible text is extracted only from completed assistant messages whose phase is not `commentary`; intermediate commentary and tool-like text can therefore never be mistaken for the final answer. Completed answer text is coalesced into one bounded event so transport jitter does not fragment browser playback. Each Responses call emits one structured Vercel log containing only the latest visitor message, that call's model output, and minimal request/round/model identifiers; it does not log the prompt, retrieved memory, prior conversation, or full input window.
- `tools.ts` imports the unified JSON tool schema collection, resolves approved link keys, validates all model-supplied arguments, and executes bounded server-side Tavily searches using `TAVILY_API_KEY`.
