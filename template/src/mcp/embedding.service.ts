import { Injectable, InternalServerErrorException } from "@nestjs/common";

@Injectable()
export class EmbeddingService {
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
      body: JSON.stringify({ model, input: text }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new InternalServerErrorException(`OpenAI Embedding API error: ${err}`);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = await response.json();
    const vector: number[] | undefined = data?.data?.[0]?.embedding;
    if (!vector || vector.length === 0) {
      throw new InternalServerErrorException("Empty embedding returned from OpenAI");
    }

    return vector;
  }
}
