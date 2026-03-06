import { Injectable, InternalServerErrorException } from "@nestjs/common";

/**
 * EmbeddingService
 * ----------------
 * Converts a plain-text string into a dense float vector using the
 * OpenAI embeddings endpoint.  The resulting vector is used by
 * PineconeService to perform similarity search against the knowledge index.
 *
 * Env vars:
 *   OPENAI_API_KEY       — required
 *   OPENAI_EMBEDDING_MODEL — optional, defaults to text-embedding-3-small
 */
@Injectable()
export class EmbeddingService {
  /**
   * Embed a single string and return the raw float vector.
   * Throws if the API key is not configured or the upstream call fails.
   */
  async embed(text: string): Promise<number[]> {
    const apiKey = process.env.OPENAI_API_KEY;
    const model  = process.env.OPENAI_EMBEDDING_MODEL ?? "text-embedding-3-small";

    if (!apiKey) throw new InternalServerErrorException("OPENAI_API_KEY not configured");

    const response = await fetch("https://api.openai.com/v1/embeddings", {
      method:  "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      // OpenAI embeddings endpoint accepts a single string or an array;
      // we always send a single string for simplicity
      body: JSON.stringify({ model, input: text }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new InternalServerErrorException(`OpenAI Embedding API error: ${err}`);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = await response.json();

    // Response shape: { data: [{ embedding: number[] }] }
    const vector: number[] | undefined = data?.data?.[0]?.embedding;
    if (!vector || vector.length === 0) {
      throw new InternalServerErrorException("Empty embedding returned from OpenAI");
    }

    return vector;
  }
}

