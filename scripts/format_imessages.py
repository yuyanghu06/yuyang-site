#!/usr/bin/env python3
"""
Flatten iMessages JSONL for pretraining.
Replaces all newlines inside each record's text with spaces so every
conversation is a single unbroken line.

Usage:
    python scripts/format_imessages.py --input data/imessages.jsonl --output data/imessages_flat.jsonl
"""

import json
import argparse
import logging
from pathlib import Path

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger(__name__)


def format_imessages(input_path: str, output_path: str):
    input_path = Path(input_path)
    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    processed = 0
    with open(input_path, encoding="utf-8") as in_f, \
         open(output_path, "w", encoding="utf-8") as out_f:
        for line in in_f:
            line = line.strip()
            if not line:
                continue
            record = json.loads(line)
            record["text"] = " ".join(record["text"].split("\n"))
            out_f.write(json.dumps(record, ensure_ascii=False) + "\n")
            processed += 1

    logger.info(f"Processed {processed} records → {output_path}")


def main():
    parser = argparse.ArgumentParser(
        description="Replace newlines in iMessages JSONL text with spaces"
    )
    parser.add_argument(
        "--input",
        default="data/imessages.jsonl",
        help="Input JSONL file (default: data/imessages.jsonl)",
    )
    parser.add_argument(
        "--output",
        default="data/imessages_flat.jsonl",
        help="Output JSONL file (default: data/imessages_flat.jsonl)",
    )
    args = parser.parse_args()
    format_imessages(args.input, args.output)


if __name__ == "__main__":
    main()
