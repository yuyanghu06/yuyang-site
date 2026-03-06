#!/usr/bin/env python3
"""
Extract raw documents (PDF, DOCX, Markdown, TXT) into JSONL text chunks for pretraining.

Outputs JSONL where each line has:
{
  "text": "<chunk>",
  "source": "<relative path to original file>"
}
"""

import argparse
import json
import logging
from pathlib import Path
from typing import List

try:
    from pypdf import PdfReader
except ImportError as e:
    raise ImportError("pypdf is required. Install with `pip install pypdf`.") from e

try:
    from docx import Document
except ImportError as e:
    raise ImportError("python-docx is required. Install with `pip install python-docx`.") from e

logging.basicConfig(level=logging.INFO, format="%(levelname)s:%(message)s")
logger = logging.getLogger(__name__)

SUPPORTED_SUFFIXES = {".pdf", ".docx", ".md", ".txt"}


def read_pdf(path: Path) -> str:
    reader = PdfReader(str(path))
    texts = []
    for page in reader.pages:
        page_text = page.extract_text() or ""
        texts.append(page_text)
    return "\n".join(texts)


def read_docx(path: Path) -> str:
    doc = Document(str(path))
    return "\n".join(p.text for p in doc.paragraphs)


def read_text_file(path: Path) -> str:
    return path.read_text(encoding="utf-8", errors="ignore")


def extract_text(path: Path) -> str:
    suffix = path.suffix.lower()
    if suffix == ".pdf":
        return read_pdf(path)
    if suffix == ".docx":
        return read_docx(path)
    if suffix in {".md", ".txt"}:
        return read_text_file(path)
    raise ValueError(f"Unsupported file type: {suffix}")


def normalize(text: str) -> str:
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    lines = [line.strip() for line in text.split("\n")]
    # Drop empty runs while keeping paragraph breaks
    cleaned_lines: List[str] = []
    for line in lines:
        if line:
            cleaned_lines.append(line)
        elif cleaned_lines and cleaned_lines[-1] != "":
            cleaned_lines.append("")
    normalized = "\n".join(cleaned_lines).strip()
    return normalized


def chunk_text(text: str, chunk_size: int, overlap: int) -> List[str]:
    if chunk_size <= overlap:
        raise ValueError("chunk_size must be larger than overlap.")
    text = text.strip()
    if not text:
        return []
    chunks: List[str] = []
    start = 0
    step = chunk_size - overlap
    while start < len(text):
        chunk = text[start : start + chunk_size].strip()
        if chunk:
            chunks.append(chunk)
        start += step
    return chunks


def collect_files(input_dir: Path) -> List[Path]:
    return [p for p in input_dir.rglob("*") if p.is_file() and p.suffix.lower() in SUPPORTED_SUFFIXES]


def process_directory(input_dir: Path, output_file: Path, chunk_size: int, overlap: int) -> int:
    files = collect_files(input_dir)
    if not files:
        logger.warning("No supported files found under %s", input_dir)
        return 0

    output_file.parent.mkdir(parents=True, exist_ok=True)
    written = 0

    with output_file.open("w", encoding="utf-8") as f:
        for file_path in files:
            try:
                raw_text = extract_text(file_path)
                text = normalize(raw_text)
                chunks = chunk_text(text, chunk_size=chunk_size, overlap=overlap)
                rel_path = file_path.relative_to(input_dir)
                for chunk in chunks:
                    record = {"text": chunk, "source": str(rel_path)}
                    f.write(json.dumps(record, ensure_ascii=False) + "\n")
                    written += 1
            except Exception as e:
                logger.error("Failed to process %s: %s", file_path, e)

    return written


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Extract PDFs/DOCX/Markdown/TXT into JSONL text chunks for pretraining."
    )
    parser.add_argument(
        "--input-dir",
        required=True,
        type=Path,
        help="Directory containing raw documents (e.g., data/raw_pdfs).",
    )
    parser.add_argument(
        "--output-file",
        required=True,
        type=Path,
        help="Path to JSONL output (e.g., data/pretrain.jsonl).",
    )
    parser.add_argument(
        "--chunk-size",
        type=int,
        default=2000,
        help="Maximum characters per chunk.",
    )
    parser.add_argument(
        "--overlap",
        type=int,
        default=200,
        help="Character overlap between consecutive chunks.",
    )
    return parser.parse_args()


def main():
    args = parse_args()
    logger.info("Scanning %s for documents...", args.input_dir)
    written = process_directory(
        args.input_dir, args.output_file, chunk_size=args.chunk_size, overlap=args.overlap
    )
    logger.info("Wrote %d chunks to %s", written, args.output_file)


if __name__ == "__main__":
    main()
