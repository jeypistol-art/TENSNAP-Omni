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
PARTIAL_END_RE = re.compile(r"[とのはをにでが]$")
REBUILD_HINT_RE = re.compile(r"([とのはをにでが]|結|見|び)$")
NOISY_UNIT_RE = re.compile(
    r"(学習単元|学習活動|典型的な活動|よく取り上げられる事柄例|変更になる場合|を理解する|について、|について|着目し|を基に|をもとに|報告書|ワークシート|住んでいる|どのような影響が|を具体的に|から.+までの|よりよく生きること|^社会 [５６65]年$|^世界平和の実現と人類の福祉の増大$|を知る。$|について考える。$|をまとめる。$)"
)
NOISY_KEYWORD_RE = re.compile(
    r"(学習単元|よく取り上げられる事柄例|典型的な活動|変更になる場合|ラーニング|チャレンジ|チェックテスト|☆印)"
)
UNIT_FIXES = {
    "人間の尊重と": "人間の尊重と基本的人権の尊重の精神",
    "政治、経済の": "政治、経済の国際化",
    "租税の意義と": "租税の意義と役割",
    "日本の位置と": "日本の位置と領土・領海・領空",
    "日本語との": "日本語との関わりが深い国",
    "幕府の政治改革と": "幕府の政治改革と政治の行き詰まり",
    "明治政府の成立と": "明治政府の成立と維新",
    "武家政治の展開と": "武家政治の展開と社会",
    "江戸幕府の成立と": "江戸幕府の成立と鎖国政策",
    "土地利用図を見て地形と土地利用を": "土地利用図と地形・土地利用",
    "個人と社会におけるルールのあン(屋台村方式)": "個人と社会におけるルールのあり方",
    "個人と社会の関わり活": "個人と社会の関わり",
    "高度経済成長期以降の社会の現": "高度経済成長期以降の社会の変化",
    "今まで学習した内容から課題を設定る。": "多面的に見た日本",
    "地域間の結び": "地域間の結び付きから見た日本",
    "産業交通の発達と": "産業交通の発達と国民生活の変化",
    "享保の改革、田沼意次の政治、寛政の改革、天": "幕府の政治改革と政治の行き詰まり",
    "我が国の国際的地": "我が国の国際的地位の向上と大陸との関係",
    "世界の地域区": "世界の地域区分",
}
DROP_UNITS = {
    "地球儀と世界地図から大陸と海洋の",
    "旅行計画にそって、地域の特色を発表する。",
    "調べたことをポスターにまとめ、報告会を行う。",
    "第二次世界大戦への道を歩んだ日本や世界の様とめる。",
    "第二次世界大戦への道を歩んだ日本や世界の様",
    "鎌倉文化、室町文化の特徴を調べ、２つの文化",
    "世界の国々と日本にある世界遺産を",
    "都市の機能、昼夜人口の変化を資料で",
    "旅行計画にそって、地域の特色を発表",
    "世界の動きと日本の動きを対比させて年表を作",
    "年表と歴史上の出来事や人物、建造物などの資",
    "郷土博物館や郷土資料から、身近な地域の文化",
    "①文化の流れ②政治の流れ③外国とのつながり",
    "時事問題に興味・関心を持ち、",
    "江戸幕府の政策が、政治の安定にとってどのよ",
    "政策作り、投票等のロールプレ",
}


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


def squash_repeated_suffix(value: str) -> str:
    text = normalize_text(value)
    dup = re.search(r"(.{1,8})\1$", text)
    if dup:
        return text[: -len(dup.group(1))]
    return text


def normalize_unit_by_keywords(unit: str, keywords: list[str]) -> str:
    text = squash_repeated_suffix(unit)
    if text in DROP_UNITS:
        return ""
    if text in UNIT_FIXES:
        return UNIT_FIXES[text]
    normalized_keywords = [normalize_text(keyword) for keyword in keywords if normalize_text(keyword)]
    if not text or not normalized_keywords:
        return text

    first = normalized_keywords[0]
    if first and text == first * 2:
        return first

    if first and first in text and not text.startswith(first) and REBUILD_HINT_RE.search(text):
        prefix = normalize_text(text.split(first, 1)[0])
        if 2 <= len(prefix) <= 16:
            return prefix

    return text


def clean_keywords(values: list[str]) -> list[str]:
    cleaned: list[str] = []
    seen: set[str] = set()
    for raw in values:
        keyword = normalize_text(str(raw))
        if not keyword or len(keyword) > 24 or NOISY_KEYWORD_RE.search(keyword):
            continue
        if "屋台村方式" in keyword or "様とめる" in keyword:
            continue
        if "ロールプレイ" in keyword or "報告書" in keyword:
            continue
        if "資料で" in keyword or "世界遺産を" in keyword:
            continue
        if re.search(r"[。]", keyword):
            continue
        if re.search(r"(発表|まとめ|設定|調べ|考え|行う|知る|演じ|つかむ)$", keyword):
            continue
        key = canonical(keyword)
        if key and key not in seen:
            seen.add(key)
            cleaned.append(keyword)
    return cleaned


def is_noisy_unit(unit: str) -> bool:
    text = normalize_text(unit)
    if not text:
        return True
    if len(text) > 36:
        return True
    if NOISY_UNIT_RE.search(text):
        return True
    return False


def reconstruct_unit(unit: str, keywords: list[str]) -> str:
    rebuilt = normalize_unit_by_keywords(unit, keywords)
    if not rebuilt or len(rebuilt) >= 24 or not REBUILD_HINT_RE.search(rebuilt):
        return rebuilt

    for keyword in keywords[:3]:
        fragment = normalize_text(keyword)
        if not fragment or len(fragment) > 16:
            continue
        rebuilt += fragment
        if len(rebuilt) >= 36:
            break
        if not PARTIAL_END_RE.search(rebuilt) and not re.search(r"[ぁ-ん]$", rebuilt):
            break
    return normalize_unit_by_keywords(rebuilt, keywords)


def has_longer_prefix_match(entry: dict[str, object], entries: list[dict[str, object]]) -> bool:
    unit = normalize_text(str(entry["unit"]))
    for other in entries:
        if other is entry:
            continue
        if normalize_text(str(other["domain"])) != normalize_text(str(entry["domain"])):
            continue
        other_unit = normalize_text(str(other["unit"]))
        if len(other_unit) <= len(unit):
            continue
        if other_unit.startswith(unit):
            return True
    return False


def clean_grade_entries(entries: list[dict[str, object]]) -> list[dict[str, object]]:
    prepared: list[dict[str, object]] = []
    for entry in entries:
        domain = normalize_text(str(entry.get("domain", "")))
        keywords = clean_keywords([str(v) for v in (entry.get("keywords") or [])])
        unit = normalize_unit_by_keywords(str(entry.get("unit", "")), keywords)
        aliases = clean_keywords([str(v) for v in (entry.get("aliases") or [])])
        if not domain or not unit or is_noisy_unit(unit):
            continue

        rebuilt = reconstruct_unit(unit, keywords)
        if len(keywords) > 20:
            continue
        prepared.append({
            "domain": domain,
            "unit": rebuilt,
            "keywords": keywords,
            "aliases": aliases,
        })

    merged: OrderedDict[tuple[str, str], dict[str, object]] = OrderedDict()
    for entry in prepared:
        key = (normalize_text(str(entry["domain"])), normalize_text(str(entry["unit"])))
        if key not in merged:
            merged[key] = {
                "domain": normalize_text(str(entry["domain"])),
                "unit": normalize_text(str(entry["unit"])),
                "keywords": clean_keywords([str(v) for v in (entry.get("keywords") or [])]),
                "aliases": clean_keywords([str(v) for v in (entry.get("aliases") or [])]),
            }
            continue
        merged[key]["keywords"] = clean_keywords(
            [*merged[key]["keywords"], *entry.get("keywords", [])]  # type: ignore[index]
        )
        merged[key]["aliases"] = clean_keywords(
            [*merged[key]["aliases"], *entry.get("aliases", [])]  # type: ignore[index]
        )

    filtered = [entry for entry in merged.values() if not has_longer_prefix_match(entry, list(merged.values()))]
    return sorted(filtered, key=lambda row: (str(row["domain"]), str(row["unit"])))


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
                "keywords": clean_keywords(keywords),
                "aliases": clean_keywords(aliases),
            }
        else:
            merged[key]["keywords"] = clean_keywords([*merged[key]["keywords"], *keywords])  # type: ignore[index]
            merged[key]["aliases"] = clean_keywords([*merged[key]["aliases"], *aliases])  # type: ignore[index]
    return clean_grade_entries(list(merged.values()))


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
