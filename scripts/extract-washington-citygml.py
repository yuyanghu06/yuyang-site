#!/usr/bin/env python3
"""Crop NYC's DA12 CityGML model to a browser-sized Washington Square asset."""

from __future__ import annotations

import argparse
import json
import statistics
import xml.etree.ElementTree as ET
from pathlib import Path

FEET_TO_METERS = 0.3048
PARK_LONGITUDE = -73.99733
PARK_LATITUDE = 40.73082
PARK_X_FEET = 984989.9975559104
PARK_Y_FEET = 205534.01551995828

NS = {
    "core": "http://www.opengis.net/citygml/1.0",
    "bldg": "http://www.opengis.net/citygml/building/1.0",
    "gml": "http://www.opengis.net/gml",
    "gen": "http://www.opengis.net/citygml/generics/1.0",
}

SURFACE_TAGS = {
    f"{{{NS['bldg']}}}GroundSurface": "ground",
    f"{{{NS['bldg']}}}RoofSurface": "roof",
    f"{{{NS['bldg']}}}WallSurface": "wall",
}


def parse_ring(text: str | None) -> list[tuple[float, float, float]]:
    if not text:
        return []
    values = [float(value) for value in text.split()]
    return [tuple(values[index : index + 3]) for index in range(0, len(values) - 2, 3)]


def building_attributes(building: ET.Element) -> dict[str, str]:
    attributes: dict[str, str] = {}
    for node in building.findall("gen:stringAttribute", NS):
        name = node.attrib.get("name", "")
        value = node.findtext("gen:value", default="", namespaces=NS)
        if name and value:
            attributes[name] = value
    return attributes


def building_surfaces(building: ET.Element) -> list[dict[str, object]]:
    surfaces: list[dict[str, object]] = []
    for node in building.iter():
        kind = SURFACE_TAGS.get(node.tag)
        if not kind:
            continue
        for polygon in node.findall(".//gml:Polygon", NS):
            exterior = polygon.find("gml:exterior/gml:LinearRing/gml:posList", NS)
            ring = parse_ring(exterior.text if exterior is not None else None)
            if len(ring) < 4:
                continue
            holes = []
            for interior in polygon.findall("gml:interior/gml:LinearRing/gml:posList", NS):
                hole = parse_ring(interior.text)
                if len(hole) >= 4:
                    holes.append(hole)
            surfaces.append({"kind": kind, "ring": ring, "holes": holes})
    return surfaces


def is_in_study(surfaces: list[dict[str, object]], radius_feet: float) -> bool:
    minimum_x = PARK_X_FEET - radius_feet
    maximum_x = PARK_X_FEET + radius_feet
    minimum_y = PARK_Y_FEET - radius_feet
    maximum_y = PARK_Y_FEET + radius_feet
    for surface in surfaces:
        for x, y, _ in surface["ring"]:  # type: ignore[index]
            if minimum_x <= x <= maximum_x and minimum_y <= y <= maximum_y:
                return True
    return False


def local_ring(ring: list[tuple[float, float, float]], reference_elevation: float) -> list[list[float]]:
    # CityGML closes rings by repeating the first point; Three.js does not need it.
    if len(ring) > 1 and ring[0] == ring[-1]:
        ring = ring[:-1]
    return [
        [
            round((x - PARK_X_FEET) * FEET_TO_METERS, 3),
            round((z - reference_elevation) * FEET_TO_METERS, 3),
            round(-(y - PARK_Y_FEET) * FEET_TO_METERS, 3),
        ]
        for x, y, z in ring
    ]


def extract(source: Path, destination: Path, radius_meters: float) -> None:
    radius_feet = radius_meters / FEET_TO_METERS
    selected: list[dict[str, object]] = []
    ground_elevations: list[float] = []
    scanned = 0

    for _, member in ET.iterparse(source, events=("end",)):
        if member.tag != f"{{{NS['core']}}}cityObjectMember":
            continue
        building = member.find("bldg:Building", NS)
        if building is not None:
            scanned += 1
            surfaces = building_surfaces(building)
            if surfaces and is_in_study(surfaces, radius_feet):
                attributes = building_attributes(building)
                for surface in surfaces:
                    if surface["kind"] == "ground":
                        ground_elevations.extend(point[2] for point in surface["ring"])  # type: ignore[index]
                selected.append({
                    "bin": attributes.get("BIN"),
                    "doittId": attributes.get("DOITT_ID"),
                    "sourceId": attributes.get("SOURCE_ID"),
                    "surfaces": surfaces,
                })
        member.clear()

    reference_elevation = statistics.median(ground_elevations) if ground_elevations else 0
    output_buildings = []
    surface_count = 0
    vertex_count = 0
    for building in selected:
        output_surfaces = []
        for surface in building["surfaces"]:  # type: ignore[index]
            ring = local_ring(surface["ring"], reference_elevation)  # type: ignore[index]
            holes = [local_ring(hole, reference_elevation) for hole in surface["holes"]]  # type: ignore[index]
            output_surfaces.append({"kind": surface["kind"], "ring": ring, "holes": holes})
            surface_count += 1
            vertex_count += len(ring) + sum(len(hole) for hole in holes)
        output_buildings.append({
            "bin": building["bin"],
            "doittId": building["doittId"],
            "sourceId": building["sourceId"],
            "surfaces": output_surfaces,
        })

    payload = {
        "source": "NYC Open Data 3-D Building Model (2014 aerial survey)",
        "sourceUrl": "https://data.cityofnewyork.us/d/tnru-abg2",
        "sourceCrs": "EPSG:2263 (US feet)",
        "units": "meters",
        "origin": {
            "longitude": PARK_LONGITUDE,
            "latitude": PARK_LATITUDE,
            "xFeet": PARK_X_FEET,
            "yFeet": PARK_Y_FEET,
            "referenceElevationFeet": round(reference_elevation, 4),
        },
        "radiusMeters": radius_meters,
        "statistics": {
            "buildingsScanned": scanned,
            "buildingsSelected": len(output_buildings),
            "surfaces": surface_count,
            "vertices": vertex_count,
        },
        "buildings": output_buildings,
    }
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(json.dumps(payload, separators=(",", ":")), encoding="utf-8")
    print(json.dumps(payload["statistics"], indent=2))
    print(f"Wrote {destination} ({destination.stat().st_size / 1024 / 1024:.2f} MiB)")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path)
    parser.add_argument("destination", type=Path)
    parser.add_argument("--radius-meters", type=float, default=680)
    args = parser.parse_args()
    extract(args.source, args.destination, args.radius_meters)


if __name__ == "__main__":
    main()
