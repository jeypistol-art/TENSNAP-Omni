#!/usr/bin/env python3
"""Clean noisy and truncated entries in the social curriculum dictionary."""

from __future__ import annotations

import json
import re
from collections import OrderedDict
from pathlib import Path


PARTIAL_END_RE = re.compile(r"[とのはをにでが]$")
REBUILD_HINT_RE = re.compile(r"([とのはをにでが]|結|見|び)$")
NOISY_UNIT_RE = re.compile(
    r"(学習単元|学習活動|典型的な活動|よく取り上げられる事柄例|変更になる場合|を理解する|について、|について|着目し|を基に|をもとに|報告書|ワークシート|住んでいる|どのような影響が|を具体的に|から.+までの|よりよく生きること)"
)
NOISY_KEYWORD_RE = re.compile(
    r"(学習単元|よく取り上げられる事柄例|典型的な活動|変更になる場合|ラーニング|チャレンジ|チェックテスト)"
)


def normalize(value: str) -> str:
    return re.sub(r"\s+", " ", (value or "").strip())


def canonical(value: str) -> str:
    return re.sub(r"[ 　/・,，。.:：;；\-＿_()（）\[\]【】]", "", normalize(value)).lower()


def squash_repeated_suffix(value: str) -> str:
    text = normalize(value)
    dup = re.search(r"(.{1,8})\1$", text)
    if dup:
        return text[: -len(dup.group(1))]
    return text


def clean_keywords(keywords: list[str]) -> list[str]:
    cleaned: list[str] = []
    seen: set[str] = set()
    for raw in keywords:
        keyword = normalize(str(raw))
        if not keyword or len(keyword) > 24 or NOISY_KEYWORD_RE.search(keyword):
            continue
        key = canonical(keyword)
        if key and key not in seen:
            seen.add(key)
            cleaned.append(keyword)
    return cleaned


def is_noisy_unit(unit: str) -> bool:
    text = normalize(unit)
    if not text:
        return True
    if len(text) > 28:
        return True
    if NOISY_UNIT_RE.search(text):
        return True
    return False


def reconstruct_unit(unit: str, keywords: list[str]) -> str:
    rebuilt = squash_repeated_suffix(unit)
    if not rebuilt or len(rebuilt) >= 24 or not REBUILD_HINT_RE.search(rebuilt):
        return rebuilt

    for keyword in keywords[:3]:
        fragment = normalize(keyword)
        if not fragment or len(fragment) > 12:
            continue
        rebuilt += fragment
        if len(rebuilt) >= 24:
            break
        if not PARTIAL_END_RE.search(rebuilt) and not re.search(r"[ぁ-ん]$", rebuilt):
            break
    return squash_repeated_suffix(rebuilt)


def has_longer_prefix_match(entry: dict, entries: list[dict]) -> bool:
    unit = normalize(entry["unit"])
    for other in entries:
        if other is entry:
            continue
        if normalize(other["domain"]) != normalize(entry["domain"]):
            continue
        other_unit = normalize(other["unit"])
        if len(other_unit) <= len(unit):
            continue
        if other_unit.startswith(unit):
            return True
    return False


def dedupe_entries(entries: list[dict]) -> list[dict]:
    merged: OrderedDict[tuple[str, str], dict] = OrderedDict()
    for entry in entries:
        key = (normalize(entry["domain"]), normalize(entry["unit"]))
        if key not in merged:
            merged[key] = {
                "domain": normalize(entry["domain"]),
                "unit": normalize(entry["unit"]),
                "keywords": clean_keywords(entry.get("keywords", [])),
                "aliases": clean_keywords(entry.get("aliases", [])),
            }
            continue

        existing = merged[key]
        existing["keywords"] = clean_keywords([*existing["keywords"], *entry.get("keywords", [])])
        existing["aliases"] = clean_keywords([*existing["aliases"], *entry.get("aliases", [])])
    return list(merged.values())


def clean_entries(entries: list[dict]) -> list[dict]:
    prepared: list[dict] = []
    for entry in entries:
        domain = normalize(entry.get("domain", ""))
        unit = squash_repeated_suffix(entry.get("unit", ""))
        keywords = clean_keywords(entry.get("keywords", []))
        aliases = clean_keywords(entry.get("aliases", []))
        if not domain or not unit or is_noisy_unit(unit):
            continue

        rebuilt = reconstruct_unit(unit, keywords)
        prepared.append({
            "domain": domain,
            "unit": rebuilt,
            "keywords": keywords,
            "aliases": aliases,
        })

    deduped = dedupe_entries(prepared)
    filtered = [entry for entry in deduped if not has_longer_prefix_match(entry, deduped)]
    return sorted(filtered, key=lambda row: (row["domain"], row["unit"]))


def main() -> int:
    path = Path(r"C:\Users\use\dev\score-snap\lib\dictionaries\social_curriculum_k12.json")
    data = json.loads(path.read_text(encoding="utf-8"))
    grades = data.get("grades", {})
    cleaned = {grade: clean_entries(entries) for grade, entries in grades.items()}
    data["grades"] = cleaned
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"[cleaned] {path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
