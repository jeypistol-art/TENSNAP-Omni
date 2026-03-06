#!/usr/bin/env python3
"""Generate an elementary math curriculum dictionary JSON from a PDF.

Usage:
  python scripts/generate_math_dictionary_from_pdf.py \
    --pdf "C:/path/to/2020_sansu_tangen.pdf" \
    --output "lib/dictionaries/math_curriculum_elem.json"
"""

from __future__ import annotations

import argparse
import base64
import json
import os
import re
from collections import OrderedDict
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import fitz  # PyMuPDF
from dotenv import load_dotenv
from openai import OpenAI


GRADE_MAP = {
    "小1": "小1",
    "小2": "小2",
    "小3": "小3",
    "小4": "小4",
    "小5": "小5",
    "小6": "小6",
    "小学1年": "小1",
    "小学2年": "小2",
    "小学3年": "小3",
    "小学4年": "小4",
    "小学5年": "小5",
    "小学6年": "小6",
    "1年": "小1",
    "2年": "小2",
    "3年": "小3",
    "4年": "小4",
    "5年": "小5",
    "6年": "小6",
}


@dataclass
class UnitItem:
    grade: str
    domain: str
    unit: str
    keywords: list[str]
    aliases: list[str]


def normalize_grade(value: str) -> str:
    text = re.sub(r"\s+", "", value or "")
    for k, v in GRADE_MAP.items():
        if k in text:
            return v
    # Common mojibake-like patterns occasionally seen in OCR/model output.
    m = re.search(r"[Пп]м([1-6])", text)
    if m:
        return f"小{m.group(1)}"
    # Generic fallback: if a single grade digit exists, normalize to 小N.
    m = re.search(r"([1-6])", text)
    if m:
        return f"小{m.group(1)}"
    return text


def normalize_text(value: str) -> str:
    return re.sub(r"\s+", " ", (value or "").strip())


def dedupe_strs(values: list[str]) -> list[str]:
    seen: OrderedDict[str, str] = OrderedDict()
    for v in values:
        n = normalize_text(v)
        if not n:
            continue
        key = n.lower()
        if key not in seen:
            seen[key] = n
    return list(seen.values())


def render_pdf_pages(pdf_path: Path, dpi: int = 170) -> list[bytes]:
    doc = fitz.open(pdf_path)
    zoom = dpi / 72
    matrix = fitz.Matrix(zoom, zoom)
    pages: list[bytes] = []
    for page in doc:
        pix = page.get_pixmap(matrix=matrix, alpha=False)
        pages.append(pix.tobytes("png"))
    doc.close()
    return pages


def ask_model_for_page(client: OpenAI, image_bytes: bytes, page_no: int) -> list[dict[str, Any]]:
    prompt = (
        "あなたは日本の小学校算数カリキュラム抽出器です。"
        "画像内の『学習内容』を、できるだけ具体的に抽出してください。"
        "抽象語ではなく単元名を優先し、JSONのみを返してください。"
        "\n\n出力形式:\n"
        "{\"units\":[{\"grade\":\"小1〜小6\",\"domain\":\"領域\",\"unit\":\"単元名\",\"keywords\":[\"語1\",\"語2\"],\"aliases\":[\"別表記\"]}]}"
        "\n\nルール:\n"
        "- grade は必ず 小1〜小6 に正規化\n"
        "- domain は短く（例: 数と計算, 図形, 量と測定, 変化と関係, データ活用）\n"
        "- unit は具体的に\n"
        "- keywords は unit の核となる語を 3〜8 語\n"
        "- aliases は表記ゆれがある場合のみ\n"
        "- 見出しだけで詳細が無い項目は除外\n"
    )

    b64 = base64.b64encode(image_bytes).decode("ascii")
    res = client.chat.completions.create(
        model="gpt-4o-mini",
        temperature=0,
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": "JSONのみ返してください。"},
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": f"ページ{page_no}を抽出してください。\n{prompt}"},
                    {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{b64}"}},
                ],
            },
        ],
    )
    content = res.choices[0].message.content or "{}"
    parsed = json.loads(content)
    units = parsed.get("units")
    if not isinstance(units, list):
        return []
    return [u for u in units if isinstance(u, dict)]


def merge_units(raw_items: list[dict[str, Any]]) -> list[UnitItem]:
    merged: OrderedDict[tuple[str, str, str], UnitItem] = OrderedDict()

    for row in raw_items:
        grade = normalize_grade(str(row.get("grade", "")))
        domain = normalize_text(str(row.get("domain", "")))
        unit = normalize_text(str(row.get("unit", "")))
        if grade not in {"小1", "小2", "小3", "小4", "小5", "小6"}:
            continue
        if not domain or not unit:
            continue

        keywords = row.get("keywords") if isinstance(row.get("keywords"), list) else []
        aliases = row.get("aliases") if isinstance(row.get("aliases"), list) else []

        key = (grade, domain, unit)
        if key not in merged:
            merged[key] = UnitItem(
                grade=grade,
                domain=domain,
                unit=unit,
                keywords=dedupe_strs([str(k) for k in keywords]),
                aliases=dedupe_strs([str(a) for a in aliases]),
            )
        else:
            existing = merged[key]
            existing.keywords = dedupe_strs(existing.keywords + [str(k) for k in keywords])
            existing.aliases = dedupe_strs(existing.aliases + [str(a) for a in aliases])

    return list(merged.values())


def to_jsonable(units: list[UnitItem], source_pdf: str) -> dict[str, Any]:
    by_grade: OrderedDict[str, list[dict[str, Any]]] = OrderedDict((g, []) for g in ["小1", "小2", "小3", "小4", "小5", "小6"])

    for u in units:
        by_grade[u.grade].append(
            {
                "domain": u.domain,
                "unit": u.unit,
                "keywords": u.keywords,
                "aliases": u.aliases,
            }
        )

    for grade in by_grade:
        by_grade[grade] = sorted(by_grade[grade], key=lambda x: (x["domain"], x["unit"]))

    return {
        "schema_version": 1,
        "source": {"pdf": source_pdf},
        "grades": by_grade,
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--pdf", required=True, help="Input PDF path")
    parser.add_argument("--output", required=True, help="Output JSON path")
    parser.add_argument("--dpi", type=int, default=170)
    args = parser.parse_args()

    load_dotenv(override=False)
    load_dotenv(Path.cwd() / ".env.local", override=False)

    api_key = os.getenv("OPENAI_API_KEY", "")
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY is not set. Set it in env or .env.local")

    pdf_path = Path(args.pdf)
    out_path = Path(args.output)
    out_path.parent.mkdir(parents=True, exist_ok=True)

    client = OpenAI(api_key=api_key)

    pages = render_pdf_pages(pdf_path, dpi=args.dpi)
    raw_items: list[dict[str, Any]] = []

    for i, png in enumerate(pages, start=1):
        print(f"[extract] page {i}/{len(pages)}")
        items = ask_model_for_page(client, png, i)
        raw_items.extend(items)

    units = merge_units(raw_items)
    result = to_jsonable(units, str(pdf_path))
    out_path.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"[done] units={len(units)} output={out_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
