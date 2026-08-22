# OpenAI and Pinecone agent foundation

- Added a server-only OpenAI Responses agent route and a bounded chat client inside the existing FaceTime guide shell.
- Made OpenAI `text-embedding-3-small` plus Pinecone similarity search mandatory before generation on every accepted user turn; the configured 1,536-dimension cosine index was verified live with 306 records.
- Added grounded source labels, prompt-injection separation for retrieved text, bounded request/history sizes, a basic request-rate guard, and safe public error responses.
- Recovered the previously authored agent tools as strict semantic contracts: persistent map navigation across four geographic views and six approved avatar emotes. The persistent map runtime now consumes validated navigation commands; emote playback remains pending approved animation assets.
- Added the official OpenAI and Pinecone SDKs. Targeted TypeScript and ESLint checks pass, invalid requests return `400`, and a live grounded request returned `200` with citations and a Manhattan navigation command.
