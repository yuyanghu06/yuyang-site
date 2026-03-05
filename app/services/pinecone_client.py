import os
from pinecone import Pinecone

_index = None


def _get_index():
    global _index
    if _index is None:
        pc = Pinecone(api_key=os.environ["PINECONE_API_KEY"])
        _index = pc.Index(os.environ["PINECONE_INDEX_NAME"])
    return _index


def upsert_vectors(vectors: list[dict]):
    _get_index().upsert(vectors=vectors)
