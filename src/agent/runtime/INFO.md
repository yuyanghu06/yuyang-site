# Agent runtime

This folder owns server-side model orchestration and the schemas and validators for agent tools.

## Direct subfolders

There are no direct subfolders.

## Direct files

- `INFO.md` documents this folder.
- `agent_tools.json` defines navigation, avatar, memory, approved-link and web-search schemas. Navigation describes all three San Diego districts and four Torrey Highlands landmarks, with destinations matching the shared camera registry.
- `run-agent.ts` defaults Responses API calls to `gpt-6-luna`, with `OPENAI_AGENT_MODEL` available as an explicit override. It loads the Markdown base prompt, adds live turn context, forces approved hyperlink lookup for explicit profile/link requests, supports enough bounded model/tool rounds to resolve the complete approved link set, and streams Thinking, Remembering, Researching, command, and answer events. Browser-visible text is extracted only from completed assistant messages whose phase is not `commentary`; intermediate commentary and tool-like text can therefore never be mistaken for the final answer. Completed answer text is coalesced into one bounded event so transport jitter does not fragment browser playback. Visitor image attachments map to Responses input_image parts alongside optional input_text. Supported document, spreadsheet, presentation and code extensions map to input_file with normalized MIME and filenames. Unknown strict UTF-8 files become explicitly delimited untrusted input_text; unknown binary files send filename and honest unavailable-content metadata only, never their bytes. Historical attachments remain in context for follow-ups; image-only and file-only turns are accepted. Attachment-bearing questions do not force approved-link lookup. No persistent uploads are created or files executed. Retrieval conversation context excludes attachments and their decoded content. Each Responses call emits one structured Vercel log with minimal request/round/model identifiers. Text-only requests retain the latest visitor message and that call's model output; any request retaining an attachment logs only its attachment count alongside those identifiers, keeping attachment bytes, decoded file contents and potentially echoed model content out of logs. Prompts, retrieved memory and prior conversation are not logged.
- `tools.ts` imports the unified JSON tool schema collection, resolves approved link keys, validates all model-supplied arguments, and executes bounded server-side Tavily searches using `TAVILY_API_KEY`.
