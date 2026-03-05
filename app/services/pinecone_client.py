import os
from pinecone import Pinecone

_pc = Pinecone(api_key=os.environ["PINECONE_API_KEY"])
_index = _pc.Index(os.environ["PINECONE_INDEX_NAME"])


def upsert_vectors(vectors: list[dict]):
    _index.upsert(vectors=vectors)
