from fastapi import APIRouter, UploadFile, File, HTTPException
from pydantic import BaseModel
from app.services.pdf_parser import extract_text_from_pdf
from app.services.chunker import chunk_text
from app.services.embedder import embed_chunks
from app.services.pinecone_client import upsert_vectors
from datetime import datetime, timezone
import uuid

router = APIRouter()


class TextIngestRequest(BaseModel):
    text: str
    source: str = "manual"


async def run_ingest_pipeline(text: str, source: str):
    chunks = chunk_text(text)
    embeddings = await embed_chunks(chunks)
    timestamp = datetime.now(timezone.utc).isoformat()
    vectors = [
        {
            "id": str(uuid.uuid4()),
            "values": embeddings[i],
            "metadata": {"text": chunks[i], "source": source, "timestamp": timestamp},
        }
        for i in range(len(chunks))
    ]
    upsert_vectors(vectors)
    return {"status": "success", "chunks_ingested": len(chunks)}


@router.post("/pdf")
async def ingest_pdf(file: UploadFile = File(...)):
    if not file.filename.endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")
    contents = await file.read()
    text = extract_text_from_pdf(contents)
    if not text.strip():
        raise HTTPException(status_code=422, detail="Could not extract text from PDF.")
    return await run_ingest_pipeline(text, source=file.filename)


@router.post("/text")
async def ingest_text(body: TextIngestRequest):
    if not body.text.strip():
        raise HTTPException(status_code=400, detail="Text body is empty.")
    return await run_ingest_pipeline(body.text, source=body.source)
