#!/usr/bin/env python3
"""Join NYC PAD addresses to cropped CityGML buildings by BIN."""

from __future__ import annotations

import argparse
import csv
import json
from collections import defaultdict
from pathlib import Path


def display_number(low: str, high: str) -> str:
    low = low.strip()
    high = high.strip()
    if not low:
        return high
    if not high or high == low:
        return low
    return f"{low}–{high}"


def build(geometry_path: Path, pad_path: Path, destination: Path) -> None:
    geometry = json.loads(geometry_path.read_text(encoding="utf-8"))
    bins = {
        str(building["bin"])
        for building in geometry["buildings"]
        if building.get("bin") and not str(building["bin"]).endswith("000000")
    }
    addresses: dict[str, list[dict[str, str]]] = defaultdict(list)
    seen: dict[str, set[tuple[str, str, str]]] = defaultdict(set)

    with pad_path.open(encoding="utf-8-sig", newline="") as file:
        for row in csv.DictReader(file):
            bin_id = row.get("bin", "").strip()
            if bin_id not in bins:
                continue
            number = display_number(row.get("lhnd", ""), row.get("hhnd", ""))
            street = row.get("stname", "").strip()
            zipcode = row.get("zipcode", "").strip()
            if not street:
                continue
            identity = (number, street, zipcode)
            if identity in seen[bin_id]:
                continue
            seen[bin_id].add(identity)
            addresses[bin_id].append({
                "number": number,
                "street": street,
                "zipcode": zipcode,
                "type": row.get("addrtype", "").strip(),
            })

    payload = {
        "source": "NYC Department of City Planning Property Address Directory 26B",
        "sourceUrl": "https://data.cityofnewyork.us/d/bc8t-ecyu",
        "joinKey": "BIN",
        "statistics": {
            "geometryBins": len(bins),
            "matchedBins": len(addresses),
            "addresses": sum(len(items) for items in addresses.values()),
        },
        "addressesByBin": dict(sorted(addresses.items())),
    }
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(json.dumps(payload, separators=(",", ":")), encoding="utf-8")
    print(json.dumps(payload["statistics"], indent=2))
    print(f"Wrote {destination} ({destination.stat().st_size / 1024:.1f} KiB)")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("geometry", type=Path)
    parser.add_argument("pad", type=Path)
    parser.add_argument("destination", type=Path)
    args = parser.parse_args()
    build(args.geometry, args.pad, args.destination)


if __name__ == "__main__":
    main()
