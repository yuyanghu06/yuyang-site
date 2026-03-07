#!/usr/bin/env python3
"""
Randomly split a JSONL file into train (80%) and validation (20%) sets.

Output files are written alongside the input with _train and _val suffixes:
  data/imessages.jsonl  →  data/imessages_train.jsonl
                           data/imessages_val.jsonl

Usage:
    python scripts/split_dataset.py --input data/imessages.jsonl
    python scripts/split_dataset.py --input data/imessages.jsonl --split 0.9
    python scripts/split_dataset.py --input data/imessages.jsonl --seed 42
"""

import json
import random
import argparse
import logging
from pathlib import Path

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger(__name__)


def split_dataset(input_path: str, split: float = 0.8, seed: int = 0):
    input_path = Path(input_path)

    with open(input_path, encoding="utf-8") as f:
        records = [line for line in f if line.strip()]

    random.seed(seed)
    random.shuffle(records)

    cutoff = int(len(records) * split)
    train_records = records[:cutoff]
    val_records = records[cutoff:]

    stem = input_path.stem
    parent = input_path.parent
    suffix = input_path.suffix

    train_path = parent / f"{stem}_train{suffix}"
    val_path = parent / f"{stem}_val{suffix}"

    with open(train_path, "w", encoding="utf-8") as f:
        f.writelines(train_records)

    with open(val_path, "w", encoding="utf-8") as f:
        f.writelines(val_records)

    logger.info(f"Total records : {len(records)}")
    logger.info(f"Train ({split:.0%}): {len(train_records)} → {train_path}")
    logger.info(f"Val   ({1-split:.0%}): {len(val_records)} → {val_path}")


def main():
    parser = argparse.ArgumentParser(
        description="Split a JSONL file into train/val sets"
    )
    parser.add_argument(
        "--input",
        required=True,
        help="Path to the input JSONL file",
    )
    parser.add_argument(
        "--split",
        type=float,
        default=0.8,
        help="Fraction of data to use for training (default: 0.8)",
    )
    parser.add_argument(
        "--seed",
        type=int,
        default=0,
        help="Random seed for reproducibility (default: 0)",
    )
    args = parser.parse_args()

    if not 0 < args.split < 1:
        parser.error("--split must be between 0 and 1 (e.g. 0.8)")

    split_dataset(args.input, args.split, args.seed)


if __name__ == "__main__":
    main()
