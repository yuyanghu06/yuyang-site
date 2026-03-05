import os
from openai import AsyncOpenAI

_client = AsyncOpenAI(api_key=os.environ["OPENAI_API_KEY"])
_MODEL = "text-embedding-3-small"


async def embed_chunks(chunks: list[str]) -> list[list[float]]:
    response = await _client.embeddings.create(input=chunks, model=_MODEL)
    return [item.embedding for item in response.data]
