#!/usr/bin/env python3
"""Light cleaner/checker for low-grade Japanese curriculum entries.

Targets only elementary lower grades because these entries are most likely to
break on PDF line wraps while also being easy to over-normalize.
"""

from __future__ import annotations

import json
import re
from collections import OrderedDict
from pathlib import Path


TARGET_GRADES = {"小1", "小2", "小3"}
NOISY_TEXT_RE = re.compile(
    r"(学習単元|学習活動|典型的な活動|よく取り上げられる事柄例|変更になる場合|ワークシート|報告書|について|着目し|を理解する)"
)


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


def squash_repeated_suffix(value: str) -> str:
    text = normalize(value)
    dup = re.search(r"(.{1,8})\1$", text)
    if dup:
        return text[: -len(dup.group(1))]
    return text


def clean_entry(entry: dict) -> dict | None:
    domain = normalize(str(entry.get("domain", "")))
    unit = squash_repeated_suffix(str(entry.get("unit", "")))
    keywords = dedupe([str(v) for v in entry.get("keywords", [])])
    aliases = dedupe([str(v) for v in entry.get("aliases", [])])

    if not domain or not unit:
        return None
    if len(unit) > 36 or NOISY_TEXT_RE.search(unit):
        return None

    cleaned_keywords = [
        keyword
        for keyword in keywords
        if len(keyword) <= 24 and not NOISY_TEXT_RE.search(keyword)
    ]

    return {
        "domain": domain,
        "unit": unit,
        "keywords": cleaned_keywords,
        "aliases": aliases,
    }


def clean_grade(entries: list[dict]) -> list[dict]:
    cleaned: list[dict] = []
    for entry in entries:
        normalized = clean_entry(entry)
        if normalized is not None:
            cleaned.append(normalized)

    merged: OrderedDict[tuple[str, str], dict] = OrderedDict()
    for entry in cleaned:
        key = (entry["domain"], entry["unit"])
        if key not in merged:
            merged[key] = entry
            continue
        merged[key]["keywords"] = dedupe([*merged[key]["keywords"], *entry["keywords"]])
        merged[key]["aliases"] = dedupe([*merged[key]["aliases"], *entry["aliases"]])

    return sorted(merged.values(), key=lambda row: (row["domain"], row["unit"]))


def main() -> int:
    path = Path(r"C:\Users\use\dev\score-snap\lib\dictionaries\japanese_curriculum_k12.json")
    data = json.loads(path.read_text(encoding="utf-8"))
    grades = data.get("grades", {})

    for grade in TARGET_GRADES:
        if grade in grades:
            grades[grade] = clean_grade(grades[grade])

    data["grades"] = grades
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"[cleaned-low-grades] {path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
