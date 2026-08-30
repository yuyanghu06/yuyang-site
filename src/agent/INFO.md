# Agent infrastructure

This folder owns the portfolio guide's shared agent contracts and server-side OpenAI/Pinecone orchestration.

## Direct subfolders

There are no direct subfolders.

## Direct files

- `INFO.md` documents this folder.
- `camera-views.ts` is the single live registry for every geographic and landmark camera view; both the runtime and agent tool schema derive their available destinations from it.
- `retrieval.ts` embeds every accepted user input with OpenAI and performs the mandatory Pinecone similarity search.
- `run-agent.ts` assembles grounded context, injects a freshly generated ISO UTC date/time for the current turn plus the live camera-view registry, instructs the model to request an emote before its accompanying response text, and streams OpenAI Responses speech-start/text events, validated client commands, and citations through the bounded tool loop.
- `tools.ts` derives map navigation choices from the live camera-view registry and defines the map-navigation and semantic-avatar-emote tools exposed to the model.
- `types.ts` derives map destinations from the camera-view registry and defines shared messages, RAG citations, speech/text stream events, commands, the three production-backed `wave_hello`, `nod_smile`, and `head_shake_disappointed` emotes, the completion-aware avatar-emote request event, the general browser command event, and the settled-map-view event used by arrival-sensitive guide dialogue.
