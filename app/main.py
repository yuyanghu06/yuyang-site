from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import ingest

app = FastAPI(title="Local Ingest Pipeline")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(ingest.router, prefix="/ingest")
