#!/usr/bin/env python3
"""Merge duplicate unit entries in math/science curriculum dictionaries."""

from __future__ import annotations

import json
import re
from collections import OrderedDict
from pathlib import Path


FILES = [
    Path(r"C:\Users\use\dev\score-snap\lib\dictionaries\math_curriculum_k12.json"),
    Path(r"C:\Users\use\dev\score-snap\lib\dictionaries\science_curriculum_k12.json"),
]


def normalize(value: str) -> str:
    return re.sub(r"\s+", " ", (value or "").strip())


def canonical(value: str) -> str:
    return re.sub(r"[ 　/・,，。.:：;；\-＿_()（）\[\]【】]", "", normalize(value)).lower()


def dedupe(values: list[str]) -> list[str]:
    seen: OrderedDict[str, str] = OrderedDict()
    for raw in values:
        value = normalize(str(raw))
        if not value:
            continue
        key = canonical(value)
        if key not in seen:
            seen[key] = value
    return list(seen.values())


def choose_domain(entries: list[dict]) -> str:
    preferred = [normalize(str(entry.get("domain", ""))) for entry in entries if normalize(str(entry.get("domain", "")))]
    if not preferred:
        return ""
    return sorted(preferred, key=lambda value: (len(value), value))[0]


def merge_entries(entries: list[dict]) -> list[dict]:
    merged: OrderedDict[str, list[dict]] = OrderedDict()
    for entry in entries:
        unit = normalize(str(entry.get("unit", "")))
        if not unit:
            continue
        key = canonical(unit)
        merged.setdefault(key, []).append(entry)

    result: list[dict] = []
    for group in merged.values():
        exemplar = group[0]
        result.append({
            "domain": choose_domain(group),
            "unit": normalize(str(exemplar.get("unit", ""))),
            "keywords": dedupe([keyword for entry in group for keyword in entry.get("keywords", [])]),
            "aliases": dedupe([alias for entry in group for alias in entry.get("aliases", [])]),
        })

    return sorted(result, key=lambda row: (row["domain"], row["unit"]))


def main() -> int:
    for path in FILES:
        data = json.loads(path.read_text(encoding="utf-8"))
        grades = data.get("grades", {})
        cleaned = {
            grade: merge_entries(entries) if isinstance(entries, list) else entries
            for grade, entries in grades.items()
        }
        data["grades"] = cleaned
        path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"[cleaned-duplicates] {path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
