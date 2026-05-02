# Example Knowledge File

This is a sample knowledge file for the AI chatbot's RAG pipeline.

## How to use

Place `.md` or `.txt` files in this `knowledge/` directory. Each file will be:
1. Read by the ingest script
2. Split into overlapping chunks
3. Embedded via OpenAI's embeddings API
4. Uploaded to your Pinecone index

## What to include

Add information about yourself that you want the chatbot to be able to reference:
- Your bio, background, and education
- Project descriptions and technical details
- Work experience and skills
- Interests, hobbies, and personal facts
- Any other information visitors might ask about

## Running the ingest

```bash
npm run ingest
```

Or use the admin ingest page at `/admin/ingest` to upload files through the browser.

## Tips

- Keep files focused on a single topic for better retrieval accuracy
- Include enough context in each file so chunks are self-contained
- Re-run `npm run ingest` after editing knowledge files to update the index
