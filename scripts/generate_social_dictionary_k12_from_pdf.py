#!/usr/bin/env python3
"""Generate a K-12 social studies curriculum dictionary JSON from local PDFs.

Usage:
  python scripts/generate_social_dictionary_k12_from_pdf.py \
    --elem-pdf "C:/path/to/小学校社会単元一覧.pdf" \
    --middle-pdf "C:/path/to/中学社会単元一覧.pdf" \
    --high-pdf "C:/path/to/高校社会単元一覧.pdf" \
    --output "lib/dictionaries/social_curriculum_k12.json"
"""

from __future__ import annotations

import argparse
import json
import re
from collections import OrderedDict
from pathlib import Path

import fitz  # PyMuPDF


VALID_GRADES = [
    "小1", "小2", "小3", "小4", "小5", "小6",
    "中1", "中2", "中3",
    "高1", "高2", "高3",
]


def normalize_text(value: str) -> str:
    text = (value or "").replace("\u3000", " ")
    text = text.replace("（", "(").replace("）", ")")
    text = re.sub(r"\s+", " ", text).strip()
    return text


def canonical(value: str) -> str:
    return re.sub(r"[ 　/・,，。.:：;；\-＿_()（）\[\]【】]", "", normalize_text(value)).lower()


def dedupe(values: list[str]) -> list[str]:
    seen: OrderedDict[str, str] = OrderedDict()
    for value in values:
        text = normalize_text(value)
        if not text:
            continue
        key = canonical(text)
        if key and key not in seen:
            seen[key] = text
    return list(seen.values())


def read_pdf_lines(pdf_path: Path) -> list[str]:
    doc = fitz.open(pdf_path)
    text = "\n".join(page.get_text() for page in doc)
    doc.close()
    return [normalize_text(line) for line in text.splitlines() if normalize_text(line)]


def infer_social_domain(text: str) -> str:
    value = normalize_text(text)
    if re.search(r"(憲法|国会|内閣|裁判所|地方自治|選挙|税|財政|金融|市場経済|労働|社会保障|国際連合|国連|平和主義|人権|民主主義|政治|経済|現代社会|倫理)", value):
        return "公民"
    if re.search(r"(時代|文化|幕府|戦争|維新|条約|改革|政権|邪馬台国|古墳|飛鳥|奈良|平安|鎌倉|室町|江戸|明治|大正|昭和|日本史|世界史|歴史)", value):
        return "歴史"
    return "地理"


def add_entry(bucket: dict[str, list[dict[str, object]]], grade: str, domain: str, unit: str, keywords: list[str] | None = None, aliases: list[str] | None = None) -> None:
    if grade not in bucket:
        bucket[grade] = []
    normalized_unit = normalize_text(unit)
    if not normalized_unit:
        return
    entry = {
        "domain": normalize_text(domain) or infer_social_domain(normalized_unit),
        "unit": normalized_unit,
        "keywords": dedupe(keywords or []),
        "aliases": dedupe(aliases or []),
    }
    bucket[grade].append(entry)


def finalize_grade_entries(entries: list[dict[str, object]]) -> list[dict[str, object]]:
    merged: OrderedDict[tuple[str, str], dict[str, object]] = OrderedDict()
    for entry in entries:
        domain = normalize_text(str(entry.get("domain", "")))
        unit = normalize_text(str(entry.get("unit", "")))
        if not domain or not unit:
            continue
        key = (domain, unit)
        keywords = [str(v) for v in (entry.get("keywords") or []) if normalize_text(str(v))]
        aliases = [str(v) for v in (entry.get("aliases") or []) if normalize_text(str(v))]
        if key not in merged:
            merged[key] = {
                "domain": domain,
                "unit": unit,
                "keywords": dedupe(keywords),
                "aliases": dedupe(aliases),
            }
        else:
            merged[key]["keywords"] = dedupe([*merged[key]["keywords"], *keywords])  # type: ignore[index]
            merged[key]["aliases"] = dedupe([*merged[key]["aliases"], *aliases])  # type: ignore[index]
    return sorted(merged.values(), key=lambda row: (str(row["domain"]), str(row["unit"])))


def parse_elementary(pdf_path: Path, bucket: dict[str, list[dict[str, object]]]) -> None:
    lines = read_pdf_lines(pdf_path)
    current_grades: list[str] = []
    current_domain = "地理"
    current_unit = ""
    current_keywords: list[str] = []

    def flush() -> None:
        nonlocal current_unit, current_keywords
        if current_grades and current_unit:
            aliases = [current_unit.split("と")[0]] if "と" in current_unit else []
            for grade in current_grades:
                add_entry(bucket, grade, current_domain, current_unit, current_keywords, aliases)
        current_unit = ""
        current_keywords = []

    for line in lines:
        if "中学入試対策" in line:
            flush()
            current_grades = []
            continue
        if re.match(r"^社会 ?[3３].*[4４]年$", line):
            flush()
            current_grades = ["小3", "小4"]
            current_domain = "地理"
            continue
        if re.match(r"^社会 ?5年$", line):
            flush()
            current_grades = ["小5"]
            current_domain = "地理"
            continue
        if re.match(r"^社会 ?6年$", line):
            flush()
            current_grades = ["小6"]
            current_domain = "歴史"
            continue
        if not current_grades:
            continue
        if re.match(r"^(No|分野|単元|ステップ内容|教科書内容|主要教科書|☆印|\d+)$", line):
            continue

        unit_match = re.match(r"^\d+\s+(.+)$", line)
        if unit_match:
            flush()
            current_unit = normalize_text(unit_match.group(1))
            if current_grades == ["小6"] and re.search(r"(政治|選挙|憲法|国際連合|地球環境|世界と日本|いろいろな国々)", current_unit):
                current_domain = "公民"
            elif current_grades == ["小6"]:
                current_domain = "歴史"
            else:
                current_domain = "地理"
            continue

        if current_unit and len(line) <= 40 and not re.search(r"(ラーニング|チャレンジ|チェックテスト)", line):
            current_keywords.append(line)

    flush()


def parse_middle(pdf_path: Path, bucket: dict[str, list[dict[str, object]]]) -> None:
    lines = read_pdf_lines(pdf_path)
    current_domain = ""
    pending_unit = ""
    pending_keywords: list[str] = []
    in_curriculum_section = False

    def flush() -> None:
        nonlocal pending_unit, pending_keywords
        if pending_unit and current_domain:
            add_entry(bucket, "中1", current_domain, pending_unit, pending_keywords)
        pending_unit = ""
        pending_keywords = []

    for line in lines:
        if line.startswith("① 地理的分野"):
            flush()
            current_domain = "地理"
            in_curriculum_section = True
            continue
        if line.startswith("② 歴史的分野"):
            flush()
            current_domain = "歴史"
            in_curriculum_section = True
            continue
        if line.startswith("③ 公民的分野"):
            flush()
            current_domain = "公民"
            in_curriculum_section = True
            continue
        if re.match(r"^[１２３４５６７８９]\）", line) or line.startswith("2）") or line.startswith("3）") or line.startswith("２）") or line.startswith("３）"):
            flush()
            in_curriculum_section = False
            continue
        if not in_curriculum_section or not current_domain:
            continue
        if re.search(r"(学習単元一覧|学習活動例|典型的な活動|備考|ねらい|該当項目|－ \d+ －)", line):
            continue
        if line.startswith("○"):
            flush()
            pending_unit = normalize_text(line.lstrip("○"))
            continue
        if not pending_unit:
            continue
        if re.match(r"^[①②③④⑤⑥⑦⑧⑨]", line):
            parts = re.findall(r"[①②③④⑤⑥⑦⑧⑨]\s*([^①②③④⑤⑥⑦⑧⑨]+)", line)
            if parts:
                pending_keywords.extend(parts)
            continue
        if line.startswith("・") or line.startswith("(") or re.match(r"^\d", line):
            continue
        if len(line) <= 45:
            pending_keywords.append(line)

    flush()


HIGH_COURSE_DOMAIN_RULES: list[tuple[re.Pattern[str], str]] = [
    (re.compile(r"(日本史|世界史)"), "歴史"),
    (re.compile(r"地理"), "地理"),
    (re.compile(r"(政治・経済|現代社会|倫理)"), "公民"),
]


def infer_high_domain(course_name: str) -> str:
    for pattern, domain in HIGH_COURSE_DOMAIN_RULES:
        if pattern.search(course_name):
            return domain
    return infer_social_domain(course_name)


def parse_high(pdf_path: Path, bucket: dict[str, list[dict[str, object]]]) -> None:
    lines = read_pdf_lines(pdf_path)
    current_course = ""
    current_domain = ""
    current_unit = ""
    current_keywords: list[str] = []
    expect_step_text = False

    def flush() -> None:
        nonlocal current_unit, current_keywords
        if current_unit and current_domain:
            add_entry(bucket, "高1", current_domain, current_unit, current_keywords, [current_course] if current_course else [])
        current_unit = ""
        current_keywords = []

    for line in lines:
        if re.search(r"(センター対策|難関大対策)", line):
            flush()
            current_course = ""
            current_domain = ""
            expect_step_text = False
            continue
        if re.match(r"^(高校単元リスト|No|分野|単元|ステップ内容|基本から学ぶ|日常学習プラス|大学入試|☆印|\d+)$", line):
            continue

        course_match = re.match(r"^(?:\d+\s+)?(.+演習)$", line)
        if course_match:
            flush()
            current_course = normalize_text(course_match.group(1))
            current_domain = infer_high_domain(current_course)
            expect_step_text = False
            continue

        unit_match = re.match(r"^\d{3}\s+(.+)$", line)
        if unit_match and current_domain:
            flush()
            current_unit = normalize_text(unit_match.group(1))
            expect_step_text = False
            continue

        if re.match(r"^\d+$", line) and current_unit:
            expect_step_text = True
            continue

        if expect_step_text and current_unit:
            current_keywords.append(line)
            expect_step_text = False
            continue

    flush()


def to_jsonable(bucket: dict[str, list[dict[str, object]]], elem_pdf: Path, middle_pdf: Path, high_pdf: Path) -> dict[str, object]:
    grades: OrderedDict[str, list[dict[str, object]]] = OrderedDict((grade, []) for grade in VALID_GRADES)
    for grade, entries in bucket.items():
        grades[grade] = finalize_grade_entries(entries)
    return {
        "schema_version": 1,
        "source": {
            "pdfs": [
                str(elem_pdf),
                str(middle_pdf),
                str(high_pdf),
            ]
        },
        "grades": grades,
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--elem-pdf", required=True)
    parser.add_argument("--middle-pdf", required=True)
    parser.add_argument("--high-pdf", required=True)
    parser.add_argument("--output", required=True)
    args = parser.parse_args()

    elem_pdf = Path(args.elem_pdf)
    middle_pdf = Path(args.middle_pdf)
    high_pdf = Path(args.high_pdf)
    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)

    bucket: dict[str, list[dict[str, object]]] = {grade: [] for grade in VALID_GRADES}
    parse_elementary(elem_pdf, bucket)
    parse_middle(middle_pdf, bucket)
    parse_high(high_pdf, bucket)

    result = to_jsonable(bucket, elem_pdf, middle_pdf, high_pdf)
    output.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"[done] output={output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
