#!/usr/bin/env python3
"""Audit curriculum dictionary JSON files for suspicious entries."""

from __future__ import annotations

import json
import re
from collections import Counter, defaultdict
from pathlib import Path


ROOT = Path(r"C:\Users\use\dev\score-snap\lib\dictionaries")
FILES = [
    "english_curriculum_k12.json",
    "japanese_curriculum_k12.json",
    "math_curriculum_elem.json",
    "math_curriculum_k12.json",
    "science_curriculum_k12.json",
    "social_curriculum_k12.json",
]

NOISY_RE = re.compile(
    r"(学習単元|学習活動|典型的な活動|よく取り上げられる事柄例|変更になる場合|ワークシート|報告書|ラーニング|チャレンジ|チェックテスト)"
)
TRUNCATED_RE = re.compile(r".+[とのはをにでが]$")
VALID_GRAMMAR_PATTERN_RE = re.compile(r"^(SV|SVC|SVO|SVOO|SVOC|第\d文型[:：]SVOO|第\d文型[:：]SVOC)$", re.I)


def normalize(value: str) -> str:
    return re.sub(r"\s+", " ", (value or "").strip())


def canonical(value: str) -> str:
    return re.sub(r"[ 　/・,，。.:：;；\-＿_()（）\[\]【】]", "", normalize(value)).lower()


def repeated_suffix(value: str) -> bool:
    text = normalize(value)
    if not text:
        return False
    if "..." in text:
        return False
    if VALID_GRAMMAR_PATTERN_RE.match(text):
        return False
    match = re.search(r"(.{1,8})\1$", text)
    if not match:
        return False
    repeated = match.group(1)
    if re.fullmatch(r"[.。・･\-\[\](){} ]+", repeated):
        return False
    if len(set(repeated)) == 1 and repeated.isalpha():
        return False
    return True


def has_duplicate_aliases(values: list[str]) -> bool:
    normalized = [canonical(value) for value in values if canonical(value)]
    return len(normalized) != len(set(normalized))


def load_entries(path: Path) -> list[tuple[str, dict]]:
    data = json.loads(path.read_text(encoding="utf-8"))
    grades = data.get("grades", {})
    if isinstance(grades, dict):
        rows: list[tuple[str, dict]] = []
        for grade, entries in grades.items():
            if isinstance(entries, list):
                rows.extend((grade, entry) for entry in entries if isinstance(entry, dict))
        return rows
    return []


def audit_file(path: Path) -> dict:
    rows = load_entries(path)
    issues: dict[str, list[str]] = defaultdict(list)
    seen_units: Counter[tuple[str, str]] = Counter()

    for grade, entry in rows:
        unit = normalize(str(entry.get("unit", "")))
        domain = normalize(str(entry.get("domain", "")))
        keywords = [normalize(str(v)) for v in entry.get("keywords", []) if normalize(str(v))]
        aliases = [normalize(str(v)) for v in entry.get("aliases", []) if normalize(str(v))]

        if not domain:
            issues["missing_domain"].append(f"{grade}: {unit or '(empty unit)'}")
        if not unit:
            issues["missing_unit"].append(f"{grade}: {domain or '(empty domain)'}")
            continue

        seen_units[(grade, canonical(unit))] += 1

        if len(unit) > 36:
            issues["long_unit"].append(f"{grade}: {unit}")
        if NOISY_RE.search(unit):
            issues["noisy_unit"].append(f"{grade}: {unit}")
        if TRUNCATED_RE.match(unit):
            issues["truncated_tail"].append(f"{grade}: {unit}")
        if repeated_suffix(unit):
            issues["repeated_suffix"].append(f"{grade}: {unit}")
        if len(keywords) > 20:
            issues["many_keywords"].append(f"{grade}: {unit} ({len(keywords)})")
        if any(len(keyword) > 24 for keyword in keywords):
            issues["long_keyword"].append(f"{grade}: {unit}")
        if any(NOISY_RE.search(keyword) for keyword in keywords):
            issues["noisy_keyword"].append(f"{grade}: {unit}")
        if has_duplicate_aliases(aliases):
            issues["repeated_alias"].append(f"{grade}: {unit}")

    for (grade, unit_key), count in seen_units.items():
        if count > 1:
            issues["duplicate_unit"].append(f"{grade}: {unit_key} x{count}")

    return {
        "file": path.name,
        "total_entries": len(rows),
        "issues": {key: values[:50] for key, values in sorted(issues.items()) if values},
    }


def main() -> int:
    reports = [audit_file(ROOT / name) for name in FILES]
    for report in reports:
        print(f"## {report['file']} ({report['total_entries']} entries)")
        issues = report["issues"]
        if not issues:
            print("OK")
            continue
        for name, values in issues.items():
            print(f"- {name}: {len(values)} shown")
            for value in values[:10]:
                print(f"  - {value}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
