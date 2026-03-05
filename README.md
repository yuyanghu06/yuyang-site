# Data Embedding Ingest Pipeline

A local pipeline that extracts text from **PDF**, **Markdown**, or **plain text**, chunks it, embeds it with OpenAI, and upserts it into Pinecone.

---

## Prerequisites

- Python 3.11+
- A [Pinecone](https://pinecone.io) account with an index created
- An [OpenAI](https://platform.openai.com) API key

---

## Setup

**1. Create and activate a virtual environment**

```bash
python -m venv venv
source venv/bin/activate        # macOS / Linux
venv\Scripts\activate           # Windows
```

**2. Install dependencies**

```bash
pip install -r requirements.txt
```

**3. Configure environment variables**

Edit `app/.env` and fill in your keys:

```env
OPENAI_API_KEY=sk-...
PINECONE_API_KEY=...
PINECONE_INDEX_NAME=your-index-name
```

> Your Pinecone index must be created beforehand and use **1536 dimensions** (matching `text-embedding-3-small`).

---

## Running the server

```bash
python run.py
```

The API will be available at `http://localhost:8000`.  
Interactive API docs: `http://localhost:8000/docs`

---

## Using the frontend

Open `frontend/index.html` directly in your browser. It connects to `http://localhost:8000` automatically.

Three ingest modes are available:

| Tab | Description |
|-----|-------------|
| **Upload PDF** | Upload a `.pdf` file — text is extracted via `pdfplumber` |
| **Upload Markdown** | Upload a `.md` or `.markdown` file — markup is stripped before embedding |
| **Paste Text** | Paste raw text directly into the textarea |

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/ingest/pdf` | Upload a PDF file (`multipart/form-data`, field: `file`) |
| `POST` | `/ingest/markdown` | Upload a Markdown file (`multipart/form-data`, field: `file`) |
| `POST` | `/ingest/text` | Send JSON body `{ "text": "...", "source": "..." }` |

All endpoints return:
```json
{ "status": "success", "chunks_ingested": 12 }
```

---

## Project Structure

```
app/
  main.py                 # FastAPI app entry point
  .env                    # API keys (not committed)
  routers/
    ingest.py             # /ingest/* route handlers
  services/
    pdf_parser.py         # PDF → text (pdfplumber)
    markdown_parser.py    # Markdown → text (regex stripping)
    chunker.py            # Text → chunks (LangChain, 500/50 tokens)
    embedder.py           # Chunks → embeddings (OpenAI)
    pinecone_client.py    # Upsert vectors to Pinecone
frontend/
  index.html              # Browser UI
requirements.txt
run.py                    # Starts uvicorn server
```
