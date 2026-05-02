import { Injectable, InternalServerErrorException } from "@nestjs/common";
import { Pinecone } from "@pinecone-database/pinecone";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { v4 as uuidv4 } from "uuid";

@Injectable()
export class IngestService {
  private readonly splitter = new RecursiveCharacterTextSplitter({
    chunkSize:    500,
    chunkOverlap: 50,
    separators:   ["\n\n", "\n", " ", ""],
  });

  async ingestPdf(buffer: Buffer, filename?: string): Promise<number> {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const pdfParse = require("pdf-parse") as (buf: Buffer) => Promise<{ text: string }>;
    const parsed = await pdfParse(buffer);
    const text   = parsed.text;

    if (!text || text.trim().length === 0) {
      throw new InternalServerErrorException("No text extracted from PDF");
    }

    return this.ingestText(text, filename ?? "pdf-upload");
  }

  async ingestText(text: string, source = "manual"): Promise<number> {
    const chunks = await this.splitter.splitText(text);
    if (chunks.length === 0) return 0;

    const apiKey = process.env.OPENAI_API_KEY;
    const model  = process.env.OPENAI_EMBEDDING_MODEL ?? "text-embedding-3-small";
    if (!apiKey) throw new InternalServerErrorException("OPENAI_API_KEY not configured");

    console.log(`[Ingest] Embedding ${chunks.length} chunks (source: ${source})`);

    const embResponse = await fetch("https://api.openai.com/v1/embeddings", {
      method:  "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ model, input: chunks }),
    });

    if (!embResponse.ok) {
      const err = await embResponse.text();
      throw new InternalServerErrorException(`OpenAI Embedding API error: ${err}`);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const embData: any = await embResponse.json();
    const embeddings: number[][] = embData.data.map((d: { embedding: number[] }) => d.embedding);

    const pineconeKey   = process.env.PINECONE_API_KEY;
    // CUSTOMIZE: Change the default index name to match your Pinecone index
    const pineconeIndex = process.env.PINECONE_INDEX ?? "my-knowledge";
    if (!pineconeKey) throw new InternalServerErrorException("PINECONE_API_KEY not configured");

    const client = new Pinecone({ apiKey: pineconeKey });
    const index  = client.index(pineconeIndex);

    const docId     = `ingest-${uuidv4().slice(0, 8)}`;
    const timestamp = new Date().toISOString();

    const vectors = chunks.map((chunk, i) => ({
      id:       `${docId}-chunk-${i}`,
      values:   embeddings[i],
      metadata: {
        text:       chunk,
        chunkIndex: i,
        docId,
        source,
        timestamp,
      },
    }));

    const BATCH_SIZE = 100;
    for (let i = 0; i < vectors.length; i += BATCH_SIZE) {
      const batch = vectors.slice(i, i + BATCH_SIZE);
      await index.upsert({ records: batch });
    }

    console.log(`[Ingest] Upserted ${chunks.length} chunks to Pinecone (docId: ${docId})`);
    return chunks.length;
  }
}
