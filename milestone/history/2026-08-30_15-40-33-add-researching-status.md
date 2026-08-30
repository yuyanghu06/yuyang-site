# Add Tavily Researching status

- Added `researching` to the shared agent stream-status contract and rendered it as the existing animated status treatment labeled `Researching…`.
- The runtime now emits `Remembering…` immediately before Pinecone retrieval and `Researching…` immediately before Tavily search, including when both tools run in one model round.
- After private server tools finish, the pending card returns to `Thinking…` while the model composes its answer.
