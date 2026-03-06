#!/usr/bin/env python3
"""Generate a K-12 math curriculum dictionary JSON from a PDF.

Usage:
  python scripts/generate_math_dictionary_k12_from_pdf.py \
    --pdf "C:/path/to/math_keitouhyo.pdf" \
    --output "lib/dictionaries/math_curriculum_k12.json"
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


VALID_GRADES = [
    "小1", "小2", "小3", "小4", "小5", "小6",
    "中1", "中2", "中3",
    "高1", "高2", "高3",
]


@dataclass
class UnitItem:
    grade: str
    domain: str
    unit: str
    keywords: list[str]
    aliases: list[str]


def normalize_text(value: str) -> str:
    return re.sub(r"\s+", " ", (value or "").strip())


def normalize_grade(value: str) -> str:
    text = normalize_text(value)
    text = text.replace("（", "(").replace("）", ")")

    # direct patterns: 小1/中2/高3 etc.
    m = re.search(r"([小中高])[\s　]*([1-3１-３1-6１-６])", text)
    if m:
        school = m.group(1)
        num = str(int(m.group(2).translate(str.maketrans("１２３４５６", "123456"))))
        grade = f"{school}{num}"
        if grade in VALID_GRADES:
            return grade

    patterns = [
        (r"小学\s*([1-6１-６])\s*年", "小"),
        (r"中学\s*([1-3１-３])\s*年", "中"),
        (r"高校\s*([1-3１-３])\s*年", "高"),
        (r"高等学校\s*([1-3１-３])\s*年", "高"),
    ]
    for pat, prefix in patterns:
        m2 = re.search(pat, text)
        if m2:
            num = str(int(m2.group(1).translate(str.maketrans("１２３４５６", "123456"))))
            grade = f"{prefix}{num}"
            if grade in VALID_GRADES:
                return grade

    # mojibake-like fallback occasionally observed for "小N".
    m3 = re.search(r"[Пп]м([1-6])", text)
    if m3:
        return f"小{m3.group(1)}"

    # K12 extraction should not guess grade from bare digits.
    return ""


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


def render_pdf_page_variants(pdf_path: Path, dpi: int = 180) -> list[tuple[str, bytes]]:
    doc = fitz.open(pdf_path)
    zoom = dpi / 72
    matrix = fitz.Matrix(zoom, zoom)
    variants: list[tuple[str, bytes]] = []
    for page_no, page in enumerate(doc, start=1):
        pix = page.get_pixmap(matrix=matrix, alpha=False)
        variants.append((f"page{page_no}-full", pix.tobytes("png")))

        # Split into 2x2 tiles to improve tiny text extraction on dense maps/charts.
        rect = page.rect
        half_w = rect.width / 2
        half_h = rect.height / 2
        tiles = [
            fitz.Rect(0, 0, half_w, half_h),
            fitz.Rect(half_w, 0, rect.width, half_h),
            fitz.Rect(0, half_h, half_w, rect.height),
            fitz.Rect(half_w, half_h, rect.width, rect.height),
        ]
        for tile_no, clip in enumerate(tiles, start=1):
            tpix = page.get_pixmap(matrix=matrix, alpha=False, clip=clip)
            variants.append((f"page{page_no}-tile{tile_no}", tpix.tobytes("png")))
    doc.close()
    return variants


def ask_model_for_page(client: OpenAI, image_bytes: bytes, page_label: str) -> list[dict[str, Any]]:
    prompt = (
        "あなたは日本の算数・数学カリキュラム抽出器です。"
        "画像内の単元相関図/系統表から、学年・領域・単元を具体語で抽出してください。"
        "JSON以外を返さないでください。"
        "\n\n出力形式:\n"
        "{\"units\":[{\"grade\":\"小1〜高3\",\"domain\":\"領域\",\"unit\":\"単元名\",\"keywords\":[\"語1\",\"語2\"],\"aliases\":[\"別表記\"]}]}"
        "\n\nルール:\n"
        "- grade は必ず 小1〜小6, 中1〜中3, 高1〜高3 に正規化\n"
        "- grade に小/中/高の接頭辞がない曖昧データは出力しない\n"
        "- domain は短く（例: 数と計算, 図形, 関数, 確率・統計, 微積分, 数列, ベクトル）\n"
        "- unit は具体的に（抽象語のみは不可）\n"
        "- keywords は unit の核となる語を 3〜8 語\n"
        "- aliases は表記ゆれがある場合のみ\n"
        "- 同一内容の重複は避ける\n"
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
                    {"type": "text", "text": f"対象領域: {page_label}\n{prompt}"},
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
        if grade not in VALID_GRADES:
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
    by_grade: OrderedDict[str, list[dict[str, Any]]] = OrderedDict((g, []) for g in VALID_GRADES)

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
    parser.add_argument("--dpi", type=int, default=180)
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
    variants = render_pdf_page_variants(pdf_path, dpi=args.dpi)
    raw_items: list[dict[str, Any]] = []

    for i, (label, png) in enumerate(variants, start=1):
        print(f"[extract] {i}/{len(variants)} {label}")
        items = ask_model_for_page(client, png, label)
        raw_items.extend(items)

    units = merge_units(raw_items)
    result = to_jsonable(units, str(pdf_path))
    out_path.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"[done] units={len(units)} output={out_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
