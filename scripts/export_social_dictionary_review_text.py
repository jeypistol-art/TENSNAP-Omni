#!/usr/bin/env python3
"""Export social curriculum dictionary entries into a human-reviewable text file."""

from __future__ import annotations

import argparse
import json
from pathlib import Path


def normalize_list(values: list[object]) -> list[str]:
    return [str(value).strip() for value in values if str(value).strip()]


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--input",
        default="lib/dictionaries/social_curriculum_k12.json",
        help="Path to social curriculum dictionary JSON",
    )
    parser.add_argument(
        "--output",
        default="tmp/social_curriculum_high_review.txt",
        help="Path to output review text file",
    )
    parser.add_argument(
        "--grades",
        nargs="*",
        default=["高1", "高2", "高3"],
        help="Grade labels to include",
    )
    args = parser.parse_args()

    input_path = Path(args.input)
    output_path = Path(args.output)
    data = json.loads(input_path.read_text(encoding="utf-8"))
    grades = data.get("grades", {})

    lines: list[str] = []
    lines.append("社会辞書レビュー一覧")
    lines.append(f"source: {input_path}")
    lines.append("")

    total = 0
    for grade in args.grades:
        rows = grades.get(grade, [])
        lines.append(f"[{grade}] {len(rows)} entries")
        if not rows:
            lines.append("(empty)")
            lines.append("")
            continue

        for index, row in enumerate(rows, start=1):
            domain = str(row.get("domain", "")).strip()
            unit = str(row.get("unit", "")).strip()
            keywords = normalize_list(list(row.get("keywords", [])))
            aliases = normalize_list(list(row.get("aliases", [])))

            lines.append(f"{index:03d}. {domain} | {unit}")
            if aliases:
                lines.append(f"  aliases: {', '.join(aliases)}")
            if keywords:
                lines.append(f"  keywords: {', '.join(keywords)}")
            lines.append("")
            total += 1

    lines.append(f"total entries: {total}")
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text("\n".join(lines), encoding="utf-8")
    print(f"[done] output={output_path}")


if __name__ == "__main__":
    main()
