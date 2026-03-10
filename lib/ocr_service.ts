import type OpenAI from "openai";
import { getOpenAIClient, runOpenAIWithRetry, serializeOpenAIError } from "@/lib/openai_client";
import { detectSubjectCategory, type SubjectCategory } from "@/lib/subjects";
import englishCurriculumK12 from "@/lib/dictionaries/english_curriculum_k12.json";
import japaneseCurriculumK12 from "@/lib/dictionaries/japanese_curriculum_k12.json";
import mathCurriculumElem from "@/lib/dictionaries/math_curriculum_elem.json";
import mathCurriculumK12 from "@/lib/dictionaries/math_curriculum_k12.json";
import scienceCurriculumK12 from "@/lib/dictionaries/science_curriculum_k12.json";
import socialCurriculumK12 from "@/lib/dictionaries/social_curriculum_k12.json";

const openai = getOpenAIClient();

// JSON Schema v4: Professional Analysis
export type AnalysisResult = {
    test_score: string; // "得点/満点" or just number string
    max_score?: number; // kept for legacy compat, but test_score string is primary source
    comprehension_score: number; // 0-100
    provisional?: boolean; // true when score is unavailable/unreliable
    raw_test_score?: string; // OCR from answer sheets only
    input_test_score?: string; // UI/DB provided score (reference only)
    detected_score_text?: string; // OCR text snippet used for score detection
    exam_phase?: boolean; // echo for UI consistency
    comprehension_details: {
        accuracy: number; // 0-100 (Score Accuracy: UI default)
        question_accuracy?: number; // 0-100 (Question-based accuracy for stability)
        process: number; // 0-100 (40% weight) - 空欄の少なさ、途中式
        consistency: number; // 0-100 (20% weight) - 安定感
    };
    insight_bullets: string[]; // 具体的なミスの傾向 (Fact)
    insight_conclusion: string; // 思考の癖 (Habit/Conclusion)
    covered_topics: string[]; // Detailed topic names
    weakness_areas: {
        topic: string;
        level: "Primary" | "Secondary";
    }[];
    wrong_question_topics?: string[]; // Topics extracted from wrong/partial questions
    disclaimer: string;
    mark_counts?: {
        circles: number; // ◯
        triangles: number; // △
        crosses: number; // ×
        slashes: number; // ／ or red slashes
        unmarked_questions?: number; // optional: detected question numbers with no marks
    };
};

type SchoolStage = "elementary" | "middle" | "high";

const SYSTEM_PROMPT = `
Role:
あなたは学習塾の「厳格な採点官」だ。
採点済みの答案と問題用紙から、忖度のない正確な評価を行い、講師の指導を強力にバックアップせよ。
ただし本タスクでは主観評価を禁止し、**物理的な採点記号のカウント**と事実の要約に集中せよ。

Instructions:
0. **教科別人格の厳守 (Subject Filter)**:
   - 教科が「国語」の場合、「途中式」「計算」「代数」「展開」「符号」等の数学語彙を使用禁止。
     代わりに「文脈」「語彙」「記述の論理性」「要旨」「表現」などを用いよ。
   - 教科が「英語」の場合、「途中式」「計算」「代数」等の数学語彙を使用禁止。
     代わりに「語彙」「文法」「時制」「読解」「語順」などを用いよ。
   - 教科が「数学」の場合は数学語彙を用いよ。

1. **講師の意図と事実の抽出 (Fact Check)**:
   - 講師の赤ペン（得点、マルバツ、コメント）を最優先でデータ化せよ。
   - **得点(test_score)は答案用紙からのみ取得**せよ。問題用紙や別ページの数字は無視すること。
   - 得点が視認できない場合は推定せず、「不明」として扱え。
   - **得点検出ルール**: 答案1枚目の上部30%のみを見て、「あなたの得点」「得点」の直後/右側にある1〜3桁の数字を抽出せよ。
     数字に「点」が付く場合は除去し、"19/100" 形式で raw_test_score に出力せよ。
     併せて検出に使ったテキスト断片を detected_score_text に入れよ。
   - **記号の定義を厳守**:
     - 丸（◯）= 正解
     - 三角（△）= 部分点（正解ではない）
     - バツ（×）/ 斜線（／）/ 赤いスラッシュ = 誤答
   - 丸以外を「正解」として数えることは禁止。
   - 設問ごとの「正誤」だけでなく「式の有無」「空欄の率」を厳密に観察せよ。
   - **本タスクでは評価や推測は禁止**。画像内の採点記号の個数を正確に数えることに集中せよ。

2. **理解度スコアの多角的算出 (Weighted Scoring)**:
   - 以下の3要素を総合して算出せよ。
     - **正答率 (Accuracy)**: 40% (純粋なマルバツの比率)
     - **完遂度 (Process)**: 40% (途中式の記述、空欄の少なさ、思考の痕跡)
     - **安定感 (Consistency)**: 20% (基本問題でのミスや、分野によるムラの少なさ)
   - **厳格ルール**:
     - 誤答（バツ/斜線）が多い場合、Processは上限を厳しく制限する。
     - 記述量が多くても、論理が成立していない場合は高得点を与えない。

3. **二段階インサイト (Layered Insights)**:
   - **Fact (insight_bullets)**: 各設問の正誤に基づいた**事実の要約**のみを記載せよ。
   - **Habit (insight_conclusion)**: 事実から推論できる学習傾向、または次のステップへの助言を述べよ。
   - **重要**: ミスが見当たらない場合、ミスの指摘を禁止し、insight_bulletsは空配列にせよ。
     その場合、insight_conclusionは「次に伸ばすべきポイント」など前向きなアドバイスに切り替えよ。

4. **弱点の優先順位付け (Priority Tagging)**:
   - 弱点を「Primary (最優先・基礎欠落)」と「Secondary (副次的・応用課題)」に分類せよ。

4.1 **社会/地理/歴史の単元抽出ルール (Specific Topic Extraction)**:
   - 教科が「社会/地理/歴史」の場合、covered_topics には設問本文に登場する具体語を優先して入れよ。
   - 具体語の例: 国名、地域名、時代名、歴史用語、地理用語（例: 「ブラジル」「関東地方」「江戸時代」「三権分立」）。
   - 「基礎知識」「地理的知識」「歴史的出来事」「地理分野」「国際関係」「日本の歴史」などの抽象語は禁止。
   - 3〜6件程度、短い名詞句で出力せよ（長文説明は不要）。
   - 特に、誤答（×/斜線）または部分点（△）が付いた設問の内容から語句を優先して抽出せよ。
   - weakness_areas.topic も同様に、誤答・部分点設問の「内容語句」をそのまま短句で記載せよ。
   - wrong_question_topics に、誤答・部分点設問から抽出した語句のみを 2〜6件で出力せよ。

4.2 **全教科共通の誤答トピック抽出 (Wrong-Question Priority)**:
   - 全教科で wrong_question_topics を出力せよ。
   - wrong_question_topics には、誤答（×/斜線）または部分点（△）の設問から抽出した語句のみを入れること。
   - 「誤答設問1」「誤答問題2」「設問3」などのプレースホルダ表現は出力禁止。必ず内容語（用語・地名・制度名など）で出力すること。
   - covered_topics や weakness_areas より、wrong_question_topics の語句を優先して選ぶこと。

4.3 **英語の単元抽出ルール (English Unit Specificity)**:
   - 教科が「英語」の場合、covered_topics と weakness_areas.topic には「文法」「語彙」「読解」「表現」などの抽象語を単独で出力してはならない。
   - 代わりに、中学英語の具体単元名を優先して出力せよ。
   - 例: 「三人称単数現在形」「接続詞 because」「SVOC（C=形容詞）」「疑問詞 + to」「現在完了形（継続用法）」「関係代名詞 who」「受け身（助動詞つき）」「want / try / need など + to」。
   - 英作文設問でも、内容面ではなく文法単元に分解して出力せよ。たとえば "I want go..." は「want / try / need など + to」を優先する。
   - 語順の誤りは、可能なら「語順」だけでなく関連する文型・構文（例: 「SVOC（C=形容詞）」）まで具体化せよ。

5. **責任ある表明 (Professional Tone)**:
   - 逃げの言葉ではなく、厳密な事実に基づいて課題を指摘する。
   - 「本分析は複数の設問傾向から推定した学習状態です」という文言を必ず添えろ。
   - **冷徹ルール**: 理解度が30%以下の場合、励ましや前向き表現を禁止し、「基礎の欠如」「壊滅的な理解不足」等の厳しい表現で課題を指摘せよ。

Output Format (JSON):
{
  "test_score": "得点/満点 (例: 75/100, 不明な場合は不明とする)",
  "comprehension_score": 0-100 (Weighted Total),
  "provisional": true|false,
  "raw_test_score": "答案画像から取得した得点",
  "input_test_score": "UI/DBから渡された得点（参考）",
  "detected_score_text": "得点検出に使ったテキスト断片",
  "exam_phase": true|false,
  "comprehension_details": { 
      "accuracy": 0-100, 
      "question_accuracy": 0-100,
      "process": 0-100, 
      "consistency": 0-100 
  },
  "insight_bullets": ["事実に基づく傾向1", "事実に基づく傾向2"],
  "insight_conclusion": "思考の傾向、または次のステップへの助言",
  "covered_topics": ["詳細な単元名1", "詳細な単元名2"],
  "weakness_areas": [
    { "topic": "単元名", "level": "Primary" },
    { "topic": "単元名", "level": "Secondary" }
  ],
  "wrong_question_topics": ["誤答設問から抽出した語句1", "誤答設問から抽出した語句2"],
  "disclaimer": "本分析は複数の設問傾向から推定した学習状態です。",
  "mark_counts": {
    "circles": 0,
    "triangles": 0,
    "crosses": 0,
    "slashes": 0,
    "unmarked_questions": 0
  }
}
`;

type WeaknessArea = {
    topic?: string;
    level?: "Primary" | "Secondary" | string;
};

function normalizeTopicLabel(value: string): string {
    return value
        .replace(/[「」"'`]/g, "")
        .replace(/\s+/g, " ")
        .trim();
}

function canonicalTopic(value: string): string {
    return normalizeTopicLabel(value)
        .toLowerCase()
        .replace(/[ 　/・,，。.:：;；\-＿_()（）[\]【】]/g, "");
}

function normalizeWeaknessLevel(level?: string): "Primary" | "Secondary" {
    return level === "Secondary" ? "Secondary" : "Primary";
}

function isCivicsKeyword(text: string): boolean {
    return /(憲法|国会|内閣|裁判所|三権分立|社会権|自由権|参政権|基本的人権|選挙|政党|地方自治|条例|請願|財政|税|租税|国際連合|国連|安全保障|PKO|条約|ASEAN|EU|NATO|WTO|SDGs|主権|人権|民主主義)/.test(text);
}

function splitSocialDomainTopic(topic: string): { domain: "地理" | "歴史" | "公民" | null; unit: string } {
    let normalized = normalizeTopicLabel(topic).replace(/：/g, ":");
    let domain: "地理" | "歴史" | "公民" | null = null;

    // Strip chained prefixes like "社会:社会:国際関係" while preserving specific domains.
    while (true) {
        const m = normalized.match(/^(地理|歴史|公民|社会)\s*:\s*(.+)$/);
        if (!m?.[1] || !m?.[2]) break;
        if (m[1] !== "社会") {
            domain = m[1] as "地理" | "歴史" | "公民";
        }
        normalized = normalizeTopicLabel(m[2]);
    }

    return { domain, unit: normalizeTopicLabel(normalized) };
}

function splitDomainTopic(topic: string): { domain: string | null; unit: string } {
    const normalized = normalizeTopicLabel(topic).replace(/：/g, ":");
    const m = normalized.match(/^([^:]+)\s*:\s*(.+)$/);
    if (m?.[1] && m?.[2]) return { domain: normalizeTopicLabel(m[1]), unit: normalizeTopicLabel(m[2]) };
    return { domain: null, unit: normalizeTopicLabel(normalized) };
}

function isPlaceholderUnit(unit: string): boolean {
    const u = normalizeTopicLabel(unit);
    if (!u) return true;
    return /^(誤答設問|誤答問題|設問|問題)\s*\d+([\-ー]\d+)?$/.test(u)
        || /^誤答設問から抽出した語句\d*$/.test(u)
        || /^wrong\s*(question|item)\s*\d+$/i.test(u);
}

type DomainHint = { domain: string; keywords: string[] };
type MathCurriculumEntry = { domain?: string; unit?: string; keywords?: string[]; aliases?: string[] };
type MathCurriculumDictionary = { grades?: Record<string, MathCurriculumEntry[]> };
type EnglishCurriculumUnitIndexEntry = { unit: string; domain: string; tokens: string[] };
type JapaneseCurriculumUnitIndexEntry = { unit: string; domain: string; grade: string; stage: SchoolStage | null; tokens: string[] };
type SocialCurriculumUnitIndexEntry = { unit: string; domain: string; grade: string; stage: SchoolStage | null; tokens: string[] };

function inferSchoolStageFromGradeLabel(grade?: string | null): SchoolStage | null {
    const g = normalizeTopicLabel(String(grade || ""));
    if (!g) return null;
    if (/(小|小学|elementary)/i.test(g)) return "elementary";
    if (/(中|中学|junior|middle)/i.test(g)) return "middle";
    if (/(高|高校|high)/i.test(g)) return "high";
    return null;
}

function inferSchoolStageFromCurriculumGrade(grade: string): SchoolStage | null {
    if (grade.startsWith("小")) return "elementary";
    if (grade.startsWith("中")) return "middle";
    if (grade.startsWith("高")) return "high";
    return null;
}

function detectDomainByHints(unit: string, hints: DomainHint[]): string | null {
    const normalized = normalizeTopicLabel(unit).toLowerCase();
    for (const hint of hints) {
        if (hint.keywords.some((k) => normalized.includes(k.toLowerCase()))) {
            return hint.domain;
        }
    }
    return null;
}

const MATH_DOMAIN_HINTS: DomainHint[] = [
    {
        domain: "計算・数",
        keywords: ["整数", "正の数", "負の数", "四則", "分数", "小数", "約数", "倍数", "素数", "割合", "比", "速さ", "単位量", "小数計算", "暗算"]
    },
    {
        domain: "代数",
        keywords: ["文字式", "方程式", "連立方程式", "不等式", "一次関数", "二次関数", "関数", "比例", "反比例", "因数分解", "展開", "平方根", "式の計算", "ベクトル", "数列", "指数", "対数", "三角関数", "微分", "積分"]
    },
    {
        domain: "図形",
        keywords: ["平面図形", "空間図形", "角度", "合同", "相似", "円", "円周角", "三平方", "面積", "体積", "作図", "証明", "座標平面", "三角形", "四角形", "多角形", "立体"]
    },
    {
        domain: "確率・統計",
        keywords: ["場合の数", "確率", "標本", "統計", "度数分布", "中央値", "平均値", "代表値", "箱ひげ図", "分散", "標準偏差", "相関", "データの活用", "期待値"]
    },
];

function buildMathHintsFromCurriculumDictionary(dict: MathCurriculumDictionary): DomainHint[] {
    const domainKeywords = new Map<string, Set<string>>();
    const grades = dict?.grades || {};
    for (const entries of Object.values(grades)) {
        if (!Array.isArray(entries)) continue;
        for (const entry of entries) {
            const domain = normalizeTopicLabel(String(entry?.domain || ""));
            if (!domain) continue;
            if (!domainKeywords.has(domain)) {
                domainKeywords.set(domain, new Set<string>());
            }
            const bucket = domainKeywords.get(domain)!;
            const unit = normalizeTopicLabel(String(entry?.unit || ""));
            if (unit) bucket.add(unit);
            if (Array.isArray(entry?.keywords)) {
                for (const k of entry.keywords) {
                    const kw = normalizeTopicLabel(String(k || ""));
                    if (kw) bucket.add(kw);
                }
            }
            if (Array.isArray(entry?.aliases)) {
                for (const a of entry.aliases) {
                    const al = normalizeTopicLabel(String(a || ""));
                    if (al) bucket.add(al);
                }
            }
        }
    }

    return Array.from(domainKeywords.entries()).map(([domain, keywords]) => ({
        domain,
        keywords: Array.from(keywords),
    }));
}

const MATH_CURRICULUM_HINTS = [
    ...buildMathHintsFromCurriculumDictionary(mathCurriculumElem as MathCurriculumDictionary),
    ...buildMathHintsFromCurriculumDictionary(mathCurriculumK12 as MathCurriculumDictionary),
];
const MATH_ALL_HINTS: DomainHint[] = [...MATH_CURRICULUM_HINTS, ...MATH_DOMAIN_HINTS];

const ENGLISH_CURRICULUM_HINTS = buildMathHintsFromCurriculumDictionary(
    englishCurriculumK12 as MathCurriculumDictionary
);
const ENGLISH_CURRICULUM_UNITS: EnglishCurriculumUnitIndexEntry[] = Object.values(
    (englishCurriculumK12 as MathCurriculumDictionary)?.grades || {}
)
    .flatMap((entries) => Array.isArray(entries) ? entries : [])
    .map((entry) => {
        const unit = normalizeTopicLabel(String(entry?.unit || ""));
        const domain = normalizeTopicLabel(String(entry?.domain || ""));
        const tokens = Array.from(
            new Set(
                [unit]
                    .concat(Array.isArray(entry?.aliases) ? entry.aliases.map((v) => normalizeTopicLabel(String(v || ""))) : [])
                    .concat(Array.isArray(entry?.keywords) ? entry.keywords.map((v) => normalizeTopicLabel(String(v || ""))) : [])
                    .filter(Boolean)
            )
        );
        return { unit, domain, tokens };
    })
    .filter((entry) => entry.unit);

const ENGLISH_DOMAIN_HINTS: DomainHint[] = [
    {
        domain: "語彙",
        keywords: ["語彙", "単語", "熟語", "イディオム", "連語", "派生語", "接頭辞", "接尾辞", "英単語", "vocabulary", "idiom"]
    },
    {
        domain: "文法",
        keywords: ["文法", "語順", "時制", "be動詞", "一般動詞", "助動詞", "不定詞", "動名詞", "分詞", "分詞構文", "受動態", "関係代名詞", "関係副詞", "比較", "仮定法", "現在完了", "品詞", "前置詞", "接続詞", "英文法"]
    },
    {
        domain: "読解",
        keywords: ["読解", "長文", "本文", "内容一致", "要旨", "段落", "指示語", "空所補充", "summary", "reading"]
    },
    {
        domain: "英作文・表現",
        keywords: ["英作文", "自由英作文", "和文英訳", "英訳", "和訳", "会話表現", "スピーチ", "ライティング", "writing", "expression"]
    },
];
const ENGLISH_ALL_HINTS: DomainHint[] = [...ENGLISH_CURRICULUM_HINTS, ...ENGLISH_DOMAIN_HINTS];

const JAPANESE_CURRICULUM_HINTS = buildMathHintsFromCurriculumDictionary(
    japaneseCurriculumK12 as MathCurriculumDictionary
);
const JAPANESE_CURRICULUM_UNITS: JapaneseCurriculumUnitIndexEntry[] = Object.entries(
    (japaneseCurriculumK12 as MathCurriculumDictionary)?.grades || {}
)
    .flatMap(([grade, entries]) => (Array.isArray(entries) ? entries : []).map((entry) => ({ grade, entry })))
    .map(({ grade, entry }) => {
        const unit = normalizeTopicLabel(String(entry?.unit || ""));
        const domain = normalizeTopicLabel(String(entry?.domain || ""));
        const tokens = Array.from(
            new Set(
                [unit]
                    .concat(Array.isArray(entry?.aliases) ? entry.aliases.map((v) => normalizeTopicLabel(String(v || ""))) : [])
                    .concat(Array.isArray(entry?.keywords) ? entry.keywords.map((v) => normalizeTopicLabel(String(v || ""))) : [])
                    .filter(Boolean)
            )
        );
        return { unit, domain, grade, stage: inferSchoolStageFromCurriculumGrade(grade), tokens };
    })
    .filter((entry) => entry.unit);

const JAPANESE_DOMAIN_HINTS: DomainHint[] = [
    {
        domain: "語彙・漢字",
        keywords: ["漢字", "語彙", "語句", "同音異義語", "同訓異字", "四字熟語", "ことわざ", "慣用句", "類義語", "対義語", "熟字訓"]
    },
    {
        domain: "文法",
        keywords: ["文法", "品詞", "活用", "敬語", "助詞", "助動詞", "連用形", "連体形", "文節", "単語", "修飾語"]
    },
    {
        domain: "読解",
        keywords: ["読解", "説明文", "論説文", "随筆", "物語", "小説", "文学的文章", "要旨", "段落", "主題", "心情", "表現技法", "詩"]
    },
    {
        domain: "古文・漢文",
        keywords: ["古文", "古典", "漢文", "返り点", "レ点", "訓読", "歴史的仮名遣い", "枕草子", "徒然草", "論語"]
    },
];
const JAPANESE_ALL_HINTS: DomainHint[] = [...JAPANESE_CURRICULUM_HINTS, ...JAPANESE_DOMAIN_HINTS];

const SCIENCE_DOMAIN_HINTS: DomainHint[] = [
    {
        domain: "物理",
        keywords: ["力", "運動", "仕事", "エネルギー", "電流", "電圧", "電力", "回路", "抵抗", "磁界", "光", "音", "波", "圧力", "浮力", "運動方程式", "熱量"]
    },
    {
        domain: "化学",
        keywords: ["化学", "原子", "分子", "イオン", "中和", "酸", "アルカリ", "気体", "水溶液", "化学反応", "質量保存", "モル", "電池", "酸化", "還元", "金属", "無機", "有機"]
    },
    {
        domain: "生物",
        keywords: ["生物", "細胞", "遺伝", "dna", "染色体", "生態系", "光合成", "呼吸", "植物", "動物", "恒常性", "神経", "感覚器", "酵素", "進化"]
    },
    {
        domain: "地学",
        keywords: ["地層", "地震", "火山", "天気", "気象", "前線", "気圧", "天体", "星", "月", "太陽", "惑星", "地球", "プレート", "岩石", "海流", "季節風"]
    },
];

const SCIENCE_CURRICULUM_HINTS = buildMathHintsFromCurriculumDictionary(
    scienceCurriculumK12 as MathCurriculumDictionary
);
const SCIENCE_ALL_HINTS: DomainHint[] = [...SCIENCE_CURRICULUM_HINTS, ...SCIENCE_DOMAIN_HINTS];

const SOCIAL_CURRICULUM_HINTS = buildMathHintsFromCurriculumDictionary(
    socialCurriculumK12 as MathCurriculumDictionary
);
const SOCIAL_CURRICULUM_UNITS: SocialCurriculumUnitIndexEntry[] = Object.entries(
    (socialCurriculumK12 as MathCurriculumDictionary)?.grades || {}
)
    .flatMap(([grade, entries]) => (Array.isArray(entries) ? entries : []).map((entry) => ({ grade, entry })))
    .map(({ grade, entry }) => {
        const unit = normalizeTopicLabel(String(entry?.unit || ""));
        const domain = normalizeTopicLabel(String(entry?.domain || ""));
        const tokens = Array.from(
            new Set(
                [unit]
                    .concat(Array.isArray(entry?.aliases) ? entry.aliases.map((v) => normalizeTopicLabel(String(v || ""))) : [])
                    .concat(Array.isArray(entry?.keywords) ? entry.keywords.map((v) => normalizeTopicLabel(String(v || ""))) : [])
                    .filter(Boolean)
            )
        );
        return { unit, domain, grade, stage: inferSchoolStageFromCurriculumGrade(grade), tokens };
    })
    .filter((entry) => entry.unit);

const SOCIAL_CIVICS_HINTS = [
    "憲法", "国会", "内閣", "裁判所", "三権分立", "人権", "社会権", "自由権", "参政権", "地方自治", "条例", "請願", "選挙", "政党",
    "財政", "税", "租税", "金融", "日銀", "市場経済", "需要", "供給", "独占", "労働", "社会保障", "国際連合", "国連", "安全保障",
    "PKO", "条約", "ASEAN", "EU", "NATO", "WTO", "SDGs", "主権", "民主主義"
];

const SOCIAL_HISTORY_HINTS = [
    "縄文", "弥生", "古墳", "飛鳥", "奈良", "平安", "鎌倉", "室町", "安土桃山", "江戸", "明治", "大正", "昭和", "平成", "令和",
    "幕府", "将軍", "大化の改新", "承久", "応仁", "黒船", "明治維新", "日清", "日露", "第一次世界大戦", "第二次世界大戦", "冷戦",
    "戦後改革", "条約改正", "殖産興業", "文明開化", "太平洋戦争", "年号", "歴史"
];

const SOCIAL_GEOGRAPHY_HINTS = [
    "地図", "地形", "緯度", "経度", "時差", "気候", "地域", "地方", "都道府県", "平野", "盆地", "山脈", "河川", "海流", "季節風",
    "人口", "都市", "貿易", "輸出", "輸入", "産業", "農業", "工業", "漁業", "資源", "エネルギー", "雨温図", "統計", "地理"
];

function isUsableSocialCurriculumUnit(entry: SocialCurriculumUnitIndexEntry): boolean {
    const unit = normalizeTopicLabel(entry.unit);
    if (!unit) return false;
    if (unit.length > 24) return false;
    if (/^(社会|社会科|社会分野|社会 \d年|小学単元リスト|高校単元リスト)$/.test(unit)) return false;
    if (/(人権尊重の社会形成|世界平和の実現と人類の福祉の増大|人間の尊重と基本|人間の尊重と$|屋台村方式|個人と社会の関わり活|個人と社会におけるルールのあ$|高度経済成長期以降の社会の現|時事問題に興味・関心を持ち、|江戸幕府の政策が、政治の安定にとってどのよ|政策作り、投票等のロールプレ|世界の自然の特色をつかみ、日本の気|世界の自然の特色をつかむ中で、日本|世界中で自分が知っている国名を発|織田信長など代表的な戦国大名の人物画、合戦|人々の生活に根ざした文化|源頼朝が武士をどのようにまとめ、勢力を拡大|産業革命による欧米諸国の経済や社会生活の変)/.test(unit)) return false;
    if (/[。]/.test(unit)) return false;
    if (/[、,]$/.test(unit)) return false;
    if (/[、,]/.test(unit) && /(発表する|まとめる|設定する|調べる|考える|行う|知る)$/.test(unit)) return false;
    if (/(発表する|まとめる|設定する|調べる|考える|行う|知る)\.?$/.test(unit)) return false;
    return !/(学習単元|学習活動|典型的な活動|よく取り上げられる事柄例|変更になる場合)/.test(unit);
}

function isShadowedSocialCurriculumUnit(
    entry: SocialCurriculumUnitIndexEntry,
    entries: SocialCurriculumUnitIndexEntry[]
): boolean {
    const unit = normalizeTopicLabel(entry.unit);
    if (!unit) return false;

    return entries.some((other) => {
        if (other === entry) return false;
        if (other.domain !== entry.domain) return false;
        const otherUnit = normalizeTopicLabel(other.unit);
        if (!otherUnit || otherUnit.length <= unit.length) return false;
        return otherUnit.startsWith(unit);
    });
}

function getEligibleSocialCurriculumUnits(schoolStage?: SchoolStage | null): SocialCurriculumUnitIndexEntry[] {
    const eligible = SOCIAL_CURRICULUM_UNITS.filter((entry) =>
        (!schoolStage || entry.stage === schoolStage) && isUsableSocialCurriculumUnit(entry)
    );
    return eligible.filter((entry) => !isShadowedSocialCurriculumUnit(entry, eligible));
}

function collectTopicBigrams(value: string): string[] {
    const normalized = canonicalTopic(value);
    if (normalized.length < 2) return normalized ? [normalized] : [];
    const grams: string[] = [];
    for (let index = 0; index < normalized.length - 1; index += 1) {
        grams.push(normalized.slice(index, index + 2));
    }
    return grams;
}

function scoreSocialCurriculumEntry(topic: string, entry: SocialCurriculumUnitIndexEntry): number {
    const candidate = canonicalTopic(topic);
    if (!candidate) return 0;

    let best = 0;
    const candidateBigrams = collectTopicBigrams(topic);
    for (const token of entry.tokens) {
        const current = canonicalTopic(token);
        if (!current) continue;
        if (current === candidate) return 100;
        if (current.includes(candidate) || candidate.includes(current)) {
            best = Math.max(best, 80);
            continue;
        }

        const tokenBigrams = new Set(collectTopicBigrams(token));
        let overlap = 0;
        for (const gram of candidateBigrams) {
            if (tokenBigrams.has(gram)) overlap += 1;
        }
        best = Math.max(best, overlap * 5);
    }

    const inferredDomain = inferSocialDomain(topic);
    if (inferredDomain && inferredDomain === entry.domain) best += 3;
    return best;
}

function findSocialCurriculumMatches(topic: string, schoolStage?: SchoolStage | null): SocialCurriculumUnitIndexEntry[] {
    const normalized = normalizeTopicLabel(topic);
    if (!normalized) return [];

    const { unit } = splitSocialDomainTopic(normalized);
    const candidate = normalizeTopicLabel(unit || normalized);
    if (!candidate) return [];

    return getEligibleSocialCurriculumUnits(schoolStage)
        .map((entry) => ({ entry, score: scoreSocialCurriculumEntry(candidate, entry) }))
        .filter(({ score }) => score >= 5)
        .sort((left, right) => right.score - left.score || right.entry.unit.length - left.entry.unit.length)
        .map(({ entry }) => entry);
}

function resolveSocialCurriculumUnit(topic: string, schoolStage?: SchoolStage | null): string | null {
    const normalized = normalizeTopicLabel(topic);
    if (!normalized) return null;

    const { unit } = splitSocialDomainTopic(normalized);
    const candidate = normalizeTopicLabel(unit || normalized);
    if (!candidate) return null;

    const [bestMatch] = findSocialCurriculumMatches(candidate, schoolStage);
    return bestMatch ? `${bestMatch.domain}：${bestMatch.unit}` : null;
}

function inferSocialDomain(unit: string): "地理" | "歴史" | "公民" | null {
    if (!unit) return null;
    const dictionaryDomain = detectDomainByHints(unit, SOCIAL_CURRICULUM_HINTS);
    if (dictionaryDomain === "地理" || dictionaryDomain === "歴史" || dictionaryDomain === "公民") return dictionaryDomain;
    if (isCivicsKeyword(unit) || SOCIAL_CIVICS_HINTS.some((k) => unit.includes(k))) return "公民";
    if (SOCIAL_HISTORY_HINTS.some((k) => unit.includes(k))) return "歴史";
    if (SOCIAL_GEOGRAPHY_HINTS.some((k) => unit.includes(k))) return "地理";
    return null;
}

function inferDomainByCategory(unit: string, category: SubjectCategory): string | null {
    if (!unit) return null;
    switch (category) {
        case "math":
            return detectDomainByHints(unit, MATH_ALL_HINTS) ?? "数学";
        case "english":
            return detectDomainByHints(unit, ENGLISH_ALL_HINTS) ?? "英語";
        case "japanese":
            return detectDomainByHints(unit, JAPANESE_ALL_HINTS) ?? "国語";
        case "science":
            return detectDomainByHints(unit, SCIENCE_ALL_HINTS) ?? "理科";
        case "social":
            return inferSocialDomain(unit) ?? "社会";
        default:
            return null;
    }
}

function canonicalEnglishTopicLabel(topic: string): string {
    const t = normalizeTopicLabel(topic).replace(/：/g, ":");
    if (!t) return "";

    if (/^リスニング/.test(t)) return "リスニング";
    if (/^英作文/.test(t)) return "英作文";
    if (/^(語彙(:語彙)?|単語|熟語)$/i.test(t)) return "語彙";
    if (/^文法:語順$/.test(t)) return "文法（語順）";
    if (/^(文法:文法|文法)$/.test(t)) return "文法（基本）";
    if (/^英文の完成:適語補充$/.test(t)) return "英文の完成（適語補充）";

    const grammar = t.match(/^文法:(.+)$/);
    if (grammar?.[1] && grammar[1] !== "文法") return grammar[1];

    const vocab = t.match(/^語彙:(.+)$/);
    if (vocab?.[1] && vocab[1] !== "語彙") return vocab[1];

    const conversation = t.match(/^会話文読解:(.+)$/);
    if (conversation?.[1]) return `会話文読解（${conversation[1]}）`;

    const reading = t.match(/^文章読解:(.+)$/);
    if (reading?.[1]) return `文章読解（${reading[1]}）`;

    return t;
}

function resolveEnglishCurriculumUnit(topic: string): string | null {
    const normalized = normalizeTopicLabel(topic);
    if (!normalized) return null;

    const { unit } = splitDomainTopic(normalized);
    const candidate = normalizeTopicLabel(unit || normalized);
    if (!candidate) return null;

    const exact = ENGLISH_CURRICULUM_UNITS.find((entry) =>
        entry.tokens.some((token) => canonicalTopic(token) === canonicalTopic(candidate))
    );
    if (exact) return exact.unit;

    const partial = ENGLISH_CURRICULUM_UNITS.find((entry) =>
        entry.tokens.some((token) => {
            const left = canonicalTopic(token);
            const right = canonicalTopic(candidate);
            return !!left && !!right && (left.includes(right) || right.includes(left));
        })
    );
    return partial?.unit || null;
}

function toEnglishDomainTopic(topic: string): string {
    const { unit } = splitDomainTopic(topic);
    const u = normalizeTopicLabel(unit || topic);
    if (!u) return "";
    if (isPlaceholderUnit(u)) return "";
    if (/^(英語|英文)$/.test(u)) return "";

    const curriculumUnit = resolveEnglishCurriculumUnit(u);
    if (curriculumUnit) return curriculumUnit;

    if (/^文法$/.test(u)) return canonicalEnglishTopicLabel("文法:文法");
    if (/^語彙$/.test(u)) return canonicalEnglishTopicLabel("語彙:語彙");
    if (/^(読解|内容理解)$/.test(u)) return canonicalEnglishTopicLabel("文章読解:内容理解");
    if (/^表現$/.test(u)) return canonicalEnglishTopicLabel("英作文");

    if (/(リスニング|聞き取り|放送|listening)/i.test(u)) return canonicalEnglishTopicLabel("リスニング");
    if (/(英作文|和文英訳|自由英作文|作文|日本語記述|ライティング|writing)/i.test(u)) return canonicalEnglishTopicLabel("英作文");
    if (/(英文の完成|適語補充|空所補充|語句補充)/.test(u)) return canonicalEnglishTopicLabel("英文の完成:適語補充");

    if (/(会話文|対話文|dialog|conversation)/i.test(u)) {
        if (/(適語補充|空所補充)/.test(u)) return canonicalEnglishTopicLabel("会話文読解:適語補充");
        if (/(日本語記述|和訳|英訳)/.test(u)) return canonicalEnglishTopicLabel("会話文読解:日本語記述");
        return canonicalEnglishTopicLabel("会話文読解:内容理解");
    }

    if (/(読解|長文|本文|内容理解|英問英答|適切選択|並べかえ|要旨|reading)/i.test(u)) {
        if (/(適語補充|空所補充)/.test(u)) return canonicalEnglishTopicLabel("文章読解:適語補充");
        if (/(英問英答)/.test(u)) return canonicalEnglishTopicLabel("文章読解:英問英答");
        if (/(適切選択)/.test(u)) return canonicalEnglishTopicLabel("文章読解:適切選択");
        if (/(並べかえ)/.test(u)) return canonicalEnglishTopicLabel("文章読解:並べかえ");
        return canonicalEnglishTopicLabel("文章読解:内容理解");
    }

    if (/(語順)/.test(u)) return canonicalEnglishTopicLabel("文法:語順");
    if (/(文法|時制|助動詞|不定詞|動名詞|関係代名詞|関係副詞|比較|受動態|現在完了|前置詞|接続詞|品詞)/.test(u)) return canonicalEnglishTopicLabel("文法:文法");
    if (/(語彙|単語|熟語|イディオム|vocabulary|idiom)/i.test(u)) return canonicalEnglishTopicLabel("語彙:語彙");
    return "";
}

function resolveJapaneseCurriculumUnit(topic: string, schoolStage?: SchoolStage | null): string | null {
    const normalized = normalizeTopicLabel(topic);
    if (!normalized) return null;

    const { unit } = splitDomainTopic(normalized);
    const candidate = normalizeTopicLabel(unit || normalized);
    if (!candidate) return null;
    const blockedUnits = new Set([
        "ことばのつかいかた",
        "ことばの意味",
        "ひらがな",
        "カタカナ",
        "小さい文字",
        "のばす音",
        "漢字の読み",
        "漢字の書き取り",
    ]);

    const exact = JAPANESE_CURRICULUM_UNITS.find((entry) =>
        (!schoolStage || entry.stage === schoolStage) &&
        !blockedUnits.has(entry.unit) &&
        entry.tokens.some((token) => canonicalTopic(token) === canonicalTopic(candidate))
    );
    if (exact) return exact.unit;

    const partial = JAPANESE_CURRICULUM_UNITS.find((entry) =>
        (!schoolStage || entry.stage === schoolStage) &&
        !blockedUnits.has(entry.unit) &&
        entry.tokens.some((token) => {
            const left = canonicalTopic(token);
            const right = canonicalTopic(candidate);
            return !!left && !!right && (left.includes(right) || right.includes(left));
        })
    );
    return partial?.unit || null;
}

function toJapaneseDomainTopic(topic: string, schoolStage?: SchoolStage | null): string {
    const { unit } = splitDomainTopic(topic);
    const u = normalizeTopicLabel(unit || topic);
    if (!u) return "";
    if (isPlaceholderUnit(u)) return "";
    if (/^(国語|本文|文章|論理性|表現力|読解力|ことばのつかいかた|ことばの意味)$/.test(u)) return "";

    if (
        /(助詞|格助詞|係助詞|接続助詞|副助詞|終助詞|文法|ことばのきまり|言葉のきまり|使い方|使いかた)/.test(u)
        && /(を|に|で|て|は|が|の|へ|と|から|より|まで|だけ|ほど|など)/.test(u)
    ) {
        return "助詞";
    }

    const curriculumUnit = resolveJapaneseCurriculumUnit(u, schoolStage);
    if (curriculumUnit) return curriculumUnit;

    if (/(指示語)/.test(u)) return "指示語";
    if (/(接続語|接続詞)/.test(u)) return "接続語";
    if (/(主語|述語)/.test(u)) return "主語・述語の関係";
    if (/(修飾語|被修飾)/.test(u)) return "修飾・被修飾の関係";
    if (/(文の組み立て|文の成分)/.test(u)) return "文の組み立て";
    if (/(言葉の単位|文節|単語)/.test(u)) return "言葉の単位";
    if (/(助詞)/.test(u)) return "助詞";
    if (/(助動詞)/.test(u)) return "助動詞";
    if (/(敬語)/.test(u)) return "敬語";
    if (/(対義語)/.test(u)) return "対義語";
    if (/(類義語)/.test(u)) return "類義語";
    if (/(慣用句)/.test(u)) return "慣用句";
    if (/(四字熟語)/.test(u)) return "四字熟語";
    if (/(故事成語)/.test(u)) return "故事成語";
    if (/(熟字訓)/.test(u)) return "熟字訓";
    if (/(同音異義|同音異字)/.test(u)) return "同音異義語";
    if (/(同訓異字)/.test(u)) return "同訓異字";
    if (/(送り仮名)/.test(u)) return "送りがな";
    if (/(音読訓読)/.test(u)) return "音読訓読";
    if (/(音読み|訓読み)/.test(u)) return "音読みと訓読み";
    if (/(返り点|レ点|一二点|上下点)/.test(u)) return "返り点";
    if (/(再読文字)/.test(u)) return "再読文字";
    if (/(受身形)/.test(u)) return "受身形";
    if (/(使役形)/.test(u)) return "使役形";
    if (/(疑問形)/.test(u)) return "疑問形";
    if (/(反語形)/.test(u)) return "反語形";
    if (/(仮定形)/.test(u)) return "仮定形";
    if (/(漢文の読み方)/.test(u)) return "漢文の読み方";
    if (/(漢詩)/.test(u)) return "漢詩";
    if (/(竹取物語)/.test(u)) return "竹取物語";
    if (/(枕草子)/.test(u)) return "枕草子";
    if (/(徒然草)/.test(u)) return "徒然草";
    if (/(平家物語)/.test(u)) return "平家物語";
    if (/(論語)/.test(u)) return "論語";
    if (/(古今和歌集|仮名序)/.test(u)) return "古今和歌集";
    if (/(万葉集)/.test(u)) return "万葉集";
    if (/(新古今和歌集)/.test(u)) return "新古今和歌集";
    if (/(奥の細道|夏草)/.test(u)) return "奥の細道";
    if (/(高瀬舟)/.test(u)) return "高瀬舟";
    if (/(故郷)/.test(u)) return "故郷";
    if (/(俳句)/.test(u)) return "俳句";
    if (/(短歌)/.test(u)) return "短歌";
    if (/(詩)/.test(u)) return "詩";
    if (/(要旨)/.test(u)) return "要旨";
    return "";
}

function formatTopicWithDomain(topic: string, category: SubjectCategory, schoolStage?: SchoolStage | null): string {
    const { domain, unit } = splitDomainTopic(topic);
    if (!unit) return "";

    if (category === "social") {
        return toSocialDomainTopic(topic, schoolStage);
    }
    if (category === "english") {
        return toEnglishDomainTopic(topic);
    }
    if (category === "japanese") {
        return toJapaneseDomainTopic(topic, schoolStage);
    }

    const resolved = domain || inferDomainByCategory(unit, category);
    return resolved ? `${resolved}：${unit}` : unit;
}

function isLowValueUnit(unit: string, category: SubjectCategory): boolean {
    const u = normalizeTopicLabel(unit);
    if (!u) return true;
    if (isPlaceholderUnit(u)) return true;
    if (category === "japanese") {
        if (/^(設問|問)\s*\d+\s*(の内容|への理解|の理解)?$/.test(u)) return true;
        if (/^(本文|文章)\s*(の内容|理解)?$/.test(u)) return true;
        if (/^内容理解$/.test(u)) return true;
    }
    if (category === "english") {
        if (/^(英語|英文|文法|語彙|読解|内容理解|表現)$/.test(u)) return true;
    }
    if (category === "social") {
        if (/^(社会|社会分野|社会科|地理|歴史|公民|知識|理解|基礎|復習|内容理解|地理的知識|歴史的出来事|歴史の出来事|国際関係|日本の歴史)$/.test(u)) return true;
        if (/(つかみ|つかむ中で|まとめ|発表|レポート|ポスター|追究|模擬旅行|旅行計画|人物画|合戦の様子|どのように|どのよ)$/.test(u)) return true;
    }
    return false;
}

function isLowValueTopic(topic: string, category: SubjectCategory): boolean {
    const { unit } = splitDomainTopic(topic);
    return isLowValueUnit(unit, category);
}

function toSocialDomainTopic(topic: string, schoolStage?: SchoolStage | null): string {
    const { domain, unit } = splitSocialDomainTopic(topic);
    if (!unit || isLowValueUnit(unit, "social")) return "";
    const curriculumUnit = resolveSocialCurriculumUnit(unit, schoolStage);
    if (curriculumUnit) return curriculumUnit;
    const resolvedDomain = domain ?? inferSocialDomain(unit);
    return resolvedDomain ? `${resolvedDomain}：${unit}` : `社会：${unit}`;
}

function isGenericWeaknessTopic(topic: string): boolean {
    return /(基礎知識が足りない|応用知識が必要|知識不足|理解不足|基礎の欠如|基礎理解が不十分|課題がある|理解が浅い|誤答設問|誤答問題)/.test(topic)
        || isPlaceholderUnit(topic);
}

function findCoveredTopicMatch(topic: string, coveredTopics: string[]): string | null {
    const cTopic = canonicalTopic(topic);
    if (!cTopic) return null;

    // exact / near-exact (normalized)
    for (const covered of coveredTopics) {
        if (canonicalTopic(covered) === cTopic) return covered;
    }
    // partial include in either direction
    for (const covered of coveredTopics) {
        const cCovered = canonicalTopic(covered);
        if (!cCovered) continue;
        if (cCovered.includes(cTopic) || cTopic.includes(cCovered)) {
            return covered;
        }
    }
    return null;
}

function extractSocialEraLabel(text: string): string | null {
    const eraPattern = /(縄文|弥生|古墳|飛鳥|奈良|平安|鎌倉|室町|安土桃山|江戸|明治|大正|昭和|平成|令和)(時代)?/;
    const m = text.match(eraPattern);
    if (!m?.[1]) return null;
    return `${m[1]}時代`;
}

function extractSocialRegionLabel(text: string): string | null {
    const regionPattern = /(北海道|東北|関東|中部|近畿|中国|四国|九州|日本|アジア|ヨーロッパ|アフリカ|オセアニア|北アメリカ|南アメリカ|世界)/;
    const m = text.match(regionPattern);
    return m?.[1] || null;
}

function toSocialDetailedWeakness(baseTopic: string, coveredTopics: string[], index: number, schoolStage?: SchoolStage | null): string {
    const normalizedTopic = toSocialDomainTopic(baseTopic, schoolStage);
    if (normalizedTopic) {
        return normalizedTopic;
    }

    const era = extractSocialEraLabel(baseTopic);
    if (era) {
        return `歴史：${era}`;
    }

    const region = extractSocialRegionLabel(baseTopic);
    if (region) {
        return `地理：${region}`;
    }

    if (/年号/.test(baseTopic)) {
        return "歴史：歴史年号";
    }

    const fallback = coveredTopics[index % Math.max(coveredTopics.length, 1)];
    if (fallback) return toSocialDomainTopic(fallback, schoolStage) || fallback;
    const lastResort = toSocialDomainTopic(baseTopic, schoolStage);
    if (lastResort) return lastResort;
    return "";
}

function toSocialSpecificWeakness(topic: string, coveredTopics: string[], index: number, schoolStage?: SchoolStage | null): string {
    return toSocialDetailedWeakness(topic, coveredTopics, index, schoolStage);
}

function extractSocialKeywordSeed(text: string): string {
    return normalizeTopicLabel(text)
        .replace(/^(最優先|関連課題|要確認)\s*/g, "")
        .replace(/(への知識定着|地域の復習|の復習|の理解が乏しい|に弱い|の理解が不十分)$/g, "")
        .trim();
}

function isSpecificSocialKeyword(topic: string): boolean {
    const { unit } = splitSocialDomainTopic(topic);
    const t = normalizeTopicLabel(unit || topic);
    if (!t || t.length < 2) return false;

    const abstractOnly = /(基礎知識|応用知識|地理的知識|歴史的出来事|歴史的事件|知識|理解|課題|分野|読み取り|復習|応用力|基礎力|思考力|判断力|表現力)/;
    const properHint = /(時代|条約|改革|戦争|内閣|幕府|憲法|地方|地域|都道府県|地形|気候|産業|貿易|平野|盆地|海流|モンスーン|EU|ASEAN|NATO|北海道|東北|関東|中部|近畿|中国|四国|九州|日本|世界|アジア|ヨーロッパ|アフリカ|オセアニア|北アメリカ|南アメリカ|ブラジル|アメリカ|中国|ロシア|インド|江戸|明治|大正|昭和|平成|令和)/;

    if (abstractOnly.test(t)) return false;
    if (isLowValueUnit(t, "social")) return false;
    if (properHint.test(t)) return true;
    // Keep short noun-like Japanese terms as fallback when not abstract.
    return /^[\p{sc=Han}\p{sc=Hiragana}\p{sc=Katakana}A-Za-z0-9・\-]{2,20}$/u.test(t);
}

function buildSpecificSocialTopics(coveredTopics: string[], weaknesses: WeaknessArea[], schoolStage?: SchoolStage | null): string[] {
    const pool = [
        ...coveredTopics,
        ...weaknesses.map((w) => String(w?.topic || "")),
    ]
        .map(extractSocialKeywordSeed)
        .map((t) => toSocialDomainTopic(t, schoolStage))
        .filter(Boolean);

    const specific = pool.filter(isSpecificSocialKeyword);
    const deduped = Array.from(new Map(specific.map((t) => [canonicalTopic(t), t] as const)).values());

    if (deduped.length > 0) return deduped.slice(0, 6);
    return coveredTopics;
}

function expandSocialCoveredTopicsToMinimum(
    topics: string[],
    wrongTopics: string[],
    schoolStage?: SchoolStage | null,
    minimum = 5
): string[] {
    const deduped = Array.from(new Map(
        topics
            .map((topic) => normalizeTopicLabel(topic))
            .filter(Boolean)
            .map((topic) => [canonicalTopic(topic), topic] as const)
    ).values());
    if (deduped.length >= minimum) return deduped;

    const relatedEntries = new Map<string, string>();
    const seeds = [...wrongTopics, ...deduped];
    for (const seed of seeds) {
        for (const entry of findSocialCurriculumMatches(seed, schoolStage)) {
            const topic = `${entry.domain}：${entry.unit}`;
            relatedEntries.set(canonicalTopic(topic), topic);
            if (deduped.length + relatedEntries.size >= minimum) break;
        }
        if (deduped.length + relatedEntries.size >= minimum) break;
    }

    if (deduped.length + relatedEntries.size < minimum) {
        const domains = new Set(
            seeds
                .map((seed) => inferSocialDomain(seed))
                .filter((domain): domain is "地理" | "歴史" | "公民" => !!domain)
        );
        for (const entry of getEligibleSocialCurriculumUnits(schoolStage)) {
            if (domains.size > 0 && !domains.has(entry.domain as "地理" | "歴史" | "公民")) continue;
            const topic = `${entry.domain}：${entry.unit}`;
            const key = canonicalTopic(topic);
            if (relatedEntries.has(key)) continue;
            relatedEntries.set(key, topic);
            if (deduped.length + relatedEntries.size >= minimum) break;
        }
    }

    return [...deduped, ...relatedEntries.values()].slice(0, Math.max(minimum, 6));
}

function buildPrioritizedSocialWeaknesses(
    wrongTopics: string[],
    socialBaseTopics: string[],
    schoolStage?: SchoolStage | null
): { topic: string; level: "Primary" | "Secondary" }[] {
    const normalizedWrongTopics = wrongTopics
        .map((topic) => toSocialDomainTopic(topic, schoolStage))
        .filter(Boolean);
    const seedTopics = normalizedWrongTopics.length > 0 ? normalizedWrongTopics : socialBaseTopics;
    if (seedTopics.length === 0) return [];

    const wrongDomainCounts = new Map<string, number>();
    for (const topic of normalizedWrongTopics) {
        const domain = splitSocialDomainTopic(topic).domain;
        if (!domain) continue;
        wrongDomainCounts.set(domain, (wrongDomainCounts.get(domain) || 0) + 1);
    }
    const domainPriority: Array<"地理" | "歴史" | "公民"> = Array.from(wrongDomainCounts.entries())
        .sort((a, b) => {
            if (b[1] !== a[1]) return b[1] - a[1];
            return a[0].localeCompare(b[0], "ja");
        })
        .map(([domain]) => domain as "地理" | "歴史" | "公民");

    const prioritizedWrongTopics = normalizedWrongTopics.length > 0
        ? [...normalizedWrongTopics].sort((a, b) => {
            const ad = splitSocialDomainTopic(a).domain;
            const bd = splitSocialDomainTopic(b).domain;
            const ai = ad ? domainPriority.indexOf(ad) : 999;
            const bi = bd ? domainPriority.indexOf(bd) : 999;
            if (ai !== bi) return ai - bi;
            return 0;
        })
        : [];

    const primaryTopic = prioritizedWrongTopics[0] || seedTopics[0];
    const primaryDomain = splitSocialDomainTopic(primaryTopic).domain;
    const prioritized = new Map<string, { topic: string; level: "Primary" | "Secondary" }>();
    prioritized.set(canonicalTopic(primaryTopic), { topic: primaryTopic, level: "Primary" });

    const pushSecondary = (topic: string) => {
        const formatted = toSocialDetailedWeakness(topic, socialBaseTopics, prioritized.size, schoolStage);
        if (!formatted || isLowValueTopic(formatted, "social")) return;
        const key = canonicalTopic(formatted);
        if (prioritized.has(key)) return;
        prioritized.set(key, { topic: formatted, level: "Secondary" });
    };

    for (const topic of prioritizedWrongTopics.slice(1)) {
        pushSecondary(topic);
        if (prioritized.size >= 5) break;
    }

    const representedDomains = new Set(
        Array.from(prioritized.values())
            .map((item) => splitSocialDomainTopic(item.topic).domain)
            .filter((domain): domain is "地理" | "歴史" | "公民" => !!domain)
    );

    for (const domain of domainPriority) {
        if (representedDomains.has(domain)) continue;
        const candidate = prioritizedWrongTopics.find((topic) => splitSocialDomainTopic(topic).domain === domain);
        if (!candidate) continue;
        pushSecondary(candidate);
        representedDomains.add(domain);
        if (prioritized.size >= 5) break;
    }

    for (const seed of prioritizedWrongTopics) {
        const seedDomain = splitSocialDomainTopic(seed).domain;
        for (const match of findSocialCurriculumMatches(seed, schoolStage)) {
            if (seedDomain && match.domain !== seedDomain) continue;
            pushSecondary(`${match.domain}：${match.unit}`);
            if (prioritized.size >= 5) break;
        }
        if (prioritized.size >= 5) break;
    }

    for (const topic of socialBaseTopics) {
        const domain = splitSocialDomainTopic(topic).domain;
        if (primaryDomain && domain && domain !== primaryDomain && representedDomains.has(domain)) continue;
        pushSecondary(topic);
        if (domain) representedDomains.add(domain);
        if (prioritized.size >= 5) break;
    }

    return Array.from(prioritized.values()).slice(0, 5);
}

function mergeSocialTopicPool(wrongTopics: string[], coveredTopics: string[], schoolStage?: SchoolStage | null): string[] {
    const merged = [...wrongTopics, ...coveredTopics]
        .map((t) => normalizeTopicLabel(String(t || "")))
        .map((t) => toSocialDomainTopic(t, schoolStage))
        .filter(Boolean);
    return Array.from(new Map(merged.map((t) => [canonicalTopic(t), t] as const)).values());
}

function prioritizeCivicsTopics(topics: string[], preferCivics: boolean): string[] {
    if (!preferCivics) return topics;
    const civics = topics.filter((t) => isCivicsKeyword(t) || t.startsWith("公民："));
    const others = topics.filter((t) => !(isCivicsKeyword(t) || t.startsWith("公民：")));
    return [...civics, ...others];
}

function isSpecificEnglishTopic(topic: string): boolean {
    const t = normalizeTopicLabel(topic);
    if (!t) return false;
    return !/^(英語|英文|語彙|文法|文法（基本）|文法（語順）|英作文|英語:表現力|英語:英語|読解|内容理解|文章読解（内容理解）|会話文読解（内容理解）)$/.test(t);
}

function isSpecificJapaneseTopic(topic: string): boolean {
    const t = normalizeTopicLabel(topic);
    if (!t) return false;
    return !/^(国語|読解|内容理解|論理性|表現力|国語:論理性|国語:表現力|古文・漢文:表現力|古文・漢文:読解|語彙・漢字|文法|古文・漢文)$/.test(t);
}

function inferEnglishTopicFromText(text: string): string | null {
    const t = normalizeTopicLabel(text);
    if (!t) return null;

    const curriculumUnit = resolveEnglishCurriculumUnit(t);
    if (curriculumUnit) return curriculumUnit;

    if (/(anything interesting|something interesting|interesting anything|find .* interesting)/i.test(t)) return "SVOC（C=形容詞）";
    if (/(he|she|it)\s+[a-z]+s\b/i.test(t) || /三人称単数|三単現|doesn'?t|does\s/i.test(t)) return "三人称単数現在形（肯定文）";
    if (/\bwant to\b/i.test(t) || /want\s+[a-z]+\s+to/i.test(t)) return "want / try / need など + to";
    if (/\bhow to\b|\bwhat to\b|\bwhere to\b|\bwhen to\b/i.test(t) || /疑問詞\s*\+\s*to/.test(t)) return "疑問詞 + to";
    if (/\bbecause\b|接続詞 because/i.test(t)) return "接続詞 because";
    if (/\bif\b|接続詞 if/i.test(t)) return "接続詞 if";
    if (/\bwhen\b|接続詞 when/i.test(t)) return "接続詞 when";
    if (/\bthat\b|that節|接続詞 that/i.test(t)) return "接続詞 that";
    if (/\bhave been\b.+ing/i.test(t) || /現在完了進行形/.test(t)) return "現在完了進行形";
    if (/\bfor\b|\bsince\b|継続用法/.test(t)) return "現在完了形（継続用法）";
    if (/\bever\b|\bnever\b|経験用法/.test(t)) return "現在完了形（経験用法・平叙文）";
    if (/\balready\b|\byet\b|\bjust\b|完了用法|結果用法/.test(t)) return "現在完了形（完了用法）";
    if (/\bhave\b|\bhas\b|現在完了/.test(t)) return "現在完了形（経験用法・平叙文）";
    if (/who/.test(t) && /関係代名詞/.test(t)) return "関係代名詞 who";
    if (/that|which/.test(t) && /関係代名詞|主格|目的格/.test(t)) return "関係代名詞（主格 that / which）";
    if (/受け身|受動態|\bbe\b.+\bby\b/i.test(t)) return "受け身（平叙文）";
    if (/be going to/i.test(t)) return "be going to";
    if (/will|未来形/.test(t)) return "助動詞 will";
    if (/there is|there are/i.test(t)) return "There is [are] ...";
    if (/look\s+\w+/i.test(t) || /look \+ 形容詞/.test(t)) return "look + 形容詞";
    if (/how many/i.test(t)) return "How many ...?";
    if (/what time/i.test(t)) return "What time ...?";
    if (/whose/i.test(t)) return "Whose ...?";
    if (/which/i.test(t)) return "Which ... (A or B)?";
    return null;
}

function inferSocialTopicFromText(text: string, schoolStage?: SchoolStage | null): string | null {
    const t = normalizeTopicLabel(text);
    if (!t) return null;
    return resolveSocialCurriculumUnit(t, schoolStage) || toSocialDomainTopic(t, schoolStage) || null;
}

function inferJapaneseTopicFromText(text: string, schoolStage?: SchoolStage | null): string | null {
    const t = normalizeTopicLabel(text);
    if (!t) return null;

    const curriculumUnit = resolveJapaneseCurriculumUnit(t, schoolStage);
    if (curriculumUnit) return curriculumUnit;
    return toJapaneseDomainTopic(t, schoolStage) || null;
}

function hasKanbunEvidence(text: string): boolean {
    const t = normalizeTopicLabel(text);
    if (!t) return false;
    return /(返り点|レ点|一二点|上下点|再読文字|書き下し|白文|句法|訓点|置き字)/.test(t);
}

function hasKobunEvidence(text: string): boolean {
    const t = normalizeTopicLabel(text);
    if (!t) return false;
    return /(古文|古典|宇治拾遺物語|枕草子|徒然草|平家物語|竹取物語|古今和歌集|万葉集|新古今和歌集|奥の細道|歴史的仮名遣い)/.test(t);
}

function requiresExplicitJapaneseTopicEvidence(topic: string): boolean {
    return /^(指示語|接続語|助詞|助動詞|敬語|主語・述語の関係|修飾・被修飾の関係|文の組み立て|言葉の単位)$/.test(topic);
}

function hasExplicitJapaneseTopicEvidence(topic: string, evidenceTexts: string[]): boolean {
    const joined = evidenceTexts.map((t) => normalizeTopicLabel(t)).filter(Boolean).join("\n");
    if (!joined) return false;

    switch (topic) {
        case "指示語":
            return /(指示語|こそあど|指し示す|指す内容|何を指す|何をさす|内容を表す言葉)/.test(joined);
        case "接続語":
            return /(接続語|接続詞|つなぐ言葉|文と文をつなぐ|文のつながり)/.test(joined);
        case "助詞":
            return /(助詞|格助詞|係助詞|接続助詞|副助詞|終助詞|てにをは)/.test(joined);
        case "助動詞":
            return /(助動詞|活用|打消|推量|意志|勧誘|受身|可能|使役|尊敬|伝聞|様態)/.test(joined);
        case "敬語":
            return /(敬語|尊敬語|謙譲語|丁寧語)/.test(joined);
        case "主語・述語の関係":
            return /(主語|述語)/.test(joined);
        case "修飾・被修飾の関係":
            return /(修飾語|被修飾|くわしくする言葉|修飾している)/.test(joined);
        case "文の組み立て":
            return /(文の組み立て|文の成分|単文|重文|複文)/.test(joined);
        case "言葉の単位":
            return /(言葉の単位|文節|単語|自立語|付属語)/.test(joined);
        default:
            return true;
    }
}

function filterJapaneseTopicsByEvidence(topics: string[], evidenceTexts: string[]): string[] {
    const hasKanbun = evidenceTexts.some(hasKanbunEvidence);
    const hasKobun = evidenceTexts.some(hasKobunEvidence);

    return topics.filter((topic) => {
        const normalized = normalizeTopicLabel(topic);
        if (!normalized) return false;
        if (requiresExplicitJapaneseTopicEvidence(normalized)) {
            return hasExplicitJapaneseTopicEvidence(normalized, evidenceTexts);
        }
        if (/^(漢文の読み方|返り点|再読文字|受身形|使役形|疑問形|反語形|仮定形)$/.test(normalized)) {
            return hasKanbun;
        }
        if (/^(論語|漢詩|漢詩の基礎知識と表現)$/.test(normalized)) {
            return hasKanbun;
        }
        if (/^(枕草子|徒然草|平家物語|竹取物語|古今和歌集|万葉集|新古今和歌集|奥の細道|高瀬舟|故郷)$/.test(normalized)) {
            return hasKobun || hasKanbun;
        }
        return true;
    });
}

function isJapaneseTopicAllowedByEvidence(topic: string, evidenceTexts: string[]): boolean {
    return filterJapaneseTopicsByEvidence([topic], evidenceTexts).length > 0;
}

function buildSpecificEnglishTopics(
    wrongTopics: string[],
    coveredTopics: string[],
    weaknesses: WeaknessArea[]
): string[] {
    const pool = [
        ...wrongTopics,
        ...coveredTopics,
        ...weaknesses.map((w) => String(w?.topic || "")),
    ]
        .map((t) => normalizeTopicLabel(String(t || "")))
        .filter(Boolean);

    const specific = pool
        .map((t) => inferEnglishTopicFromText(t) || toEnglishDomainTopic(t))
        .filter(Boolean)
        .filter(isSpecificEnglishTopic);

    return Array.from(new Map(specific.map((t) => [canonicalTopic(t), t] as const)).values()).slice(0, 6);
}

function buildSpecificJapaneseTopics(
    wrongTopics: string[],
    coveredTopics: string[],
    weaknesses: WeaknessArea[],
    schoolStage?: SchoolStage | null
): string[] {
    const pool = [
        ...wrongTopics,
        ...coveredTopics,
        ...weaknesses.map((w) => String(w?.topic || "")),
    ]
        .map((t) => normalizeTopicLabel(String(t || "")))
        .filter(Boolean);

    const specific = pool
        .map((t) => inferJapaneseTopicFromText(t, schoolStage) || toJapaneseDomainTopic(t, schoolStage))
        .filter(Boolean)
        .filter(isSpecificJapaneseTopic);

    const filtered = filterJapaneseTopicsByEvidence(specific, pool);
    return Array.from(new Map(filtered.map((t) => [canonicalTopic(t), t] as const)).values()).slice(0, 6);
}

function sanitizeWeaknessAreas(
    inputWeaknesses: WeaknessArea[] | undefined,
    inputCoveredTopics: string[] | undefined,
    subject: string,
    wrongQuestionTopics?: string[] | undefined,
    schoolStage?: SchoolStage | null
): { coveredTopics: string[]; weaknessAreas: { topic: string; level: "Primary" | "Secondary" }[] } {
    const coveredTopics = Array.from(
        new Set(
            (Array.isArray(inputCoveredTopics) ? inputCoveredTopics : [])
                .map((t) => normalizeTopicLabel(String(t || "")))
                .filter(Boolean)
        )
    );

    const lowerSubject = subject.toLowerCase();
    const isScience = /理科|科学|理数|science|stem/.test(lowerSubject);
    const isSocial = /社会|地理|歴史|公民|social|geography|history|civics/.test(lowerSubject);
    const subjectCategory = detectSubjectCategory(subject);
    const isEnglish = subjectCategory === "english";
    const isJapanese = subjectCategory === "japanese";
    const rawWeaknesses = Array.isArray(inputWeaknesses) ? inputWeaknesses : [];
    const coveredDomainTopics = Array.from(
        new Map(
            coveredTopics
                .map((t) => formatTopicWithDomain(t, subjectCategory, schoolStage))
                .filter(Boolean)
                .map((t) => [canonicalTopic(t), t] as const)
        ).values()
    );
    const wrongTopics = Array.from(
        new Set(
            (Array.isArray(wrongQuestionTopics) ? wrongQuestionTopics : [])
                .map((t) => normalizeTopicLabel(String(t || "")))
                .map((t) => {
                    if (isSocial) return inferSocialTopicFromText(t, schoolStage) || toSocialDomainTopic(t, schoolStage);
                    if (isEnglish) return inferEnglishTopicFromText(t) || resolveEnglishCurriculumUnit(t) || "";
                    if (isJapanese) return inferJapaneseTopicFromText(t, schoolStage) || resolveJapaneseCurriculumUnit(t, schoolStage) || "";
                    return formatTopicWithDomain(t, subjectCategory, schoolStage);
                })
                .filter(Boolean)
        )
    );
    const nonSocialBaseTopics = !isSocial
        ? Array.from(
            new Map(
                (wrongTopics.length > 0 ? [...wrongTopics, ...coveredDomainTopics] : coveredDomainTopics)
                    .map((t) => [canonicalTopic(t), t] as const)
            ).values()
        )
        : [];
    const preferCivics = isSocial && wrongTopics.some((t) => isCivicsKeyword(t) || t.startsWith("公民："));
    const socialSpecificTopics = isSocial
        ? (
            wrongTopics.length > 0
                ? buildSpecificSocialTopics(mergeSocialTopicPool(wrongTopics, coveredTopics, schoolStage), rawWeaknesses, schoolStage)
                : buildSpecificSocialTopics(coveredTopics, rawWeaknesses, schoolStage)
        )
        : coveredTopics;
    const socialBaseTopics = isSocial && socialSpecificTopics.length > 0
        ? prioritizeCivicsTopics(
            expandSocialCoveredTopicsToMinimum(socialSpecificTopics, wrongTopics, schoolStage, 5),
            preferCivics
        )
        : coveredTopics;
    const englishSpecificTopics = isEnglish
        ? buildSpecificEnglishTopics(wrongTopics, coveredTopics, rawWeaknesses)
        : [];
    const englishBaseTopics = isEnglish && englishSpecificTopics.length > 0
        ? englishSpecificTopics
        : nonSocialBaseTopics;
    const japaneseSpecificTopics = isJapanese
        ? buildSpecificJapaneseTopics(wrongTopics, coveredTopics, rawWeaknesses, schoolStage)
        : [];
    const japaneseBaseTopics = isJapanese && japaneseSpecificTopics.length > 0
        ? japaneseSpecificTopics
        : nonSocialBaseTopics;
    const japaneseEvidencePool = isJapanese
        ? [
            ...wrongTopics,
            ...coveredTopics,
            ...rawWeaknesses.map((w) => normalizeTopicLabel(String(w?.topic || ""))),
        ].filter(Boolean)
        : [];

    const sanitized = rawWeaknesses
        .map((w, index) => {
            const rawTopic = normalizeTopicLabel(String(w?.topic || ""));
            if (!rawTopic) return null;

            const matchedCovered = findCoveredTopicMatch(rawTopic, coveredTopics);
            let topic = rawTopic;
            const level = normalizeWeaknessLevel(w?.level);
            const isPlaceholderTopic = isSocial && isLowValueUnit(rawTopic, "social");

            if (isScience) {
                // Science-family: prioritize wrong-question topics first, then covered topics.
                const matchedScienceBase = findCoveredTopicMatch(rawTopic, nonSocialBaseTopics);
                if (matchedScienceBase) {
                    topic = matchedScienceBase;
                } else if (nonSocialBaseTopics.length > 0 && isGenericWeaknessTopic(rawTopic)) {
                    topic = nonSocialBaseTopics[Math.min(index, nonSocialBaseTopics.length - 1)];
                } else {
                    return null;
                }
            } else if (isSocial) {
                if (isPlaceholderTopic) {
                    if (socialBaseTopics.length > 0) {
                        topic = toSocialDetailedWeakness(
                            socialBaseTopics[Math.min(index, socialBaseTopics.length - 1)],
                            socialBaseTopics,
                            index,
                            schoolStage
                        );
                    } else {
                        return null;
                    }
                } else {
                const matchedSocial = findCoveredTopicMatch(rawTopic, socialBaseTopics);
                if (matchedSocial) {
                    topic = toSocialDetailedWeakness(matchedSocial, socialBaseTopics, index, schoolStage);
                } else if (isGenericWeaknessTopic(rawTopic)) {
                    topic = toSocialSpecificWeakness(rawTopic, socialBaseTopics, index, schoolStage);
                } else {
                    topic = toSocialDetailedWeakness(rawTopic, socialBaseTopics, index, schoolStage);
                }
                }
            } else {
                const currentBaseTopics = isEnglish
                    ? englishBaseTopics
                    : isJapanese
                        ? japaneseBaseTopics
                        : nonSocialBaseTopics;
                const matchedNonSocial = findCoveredTopicMatch(rawTopic, currentBaseTopics);
                if (matchedNonSocial) {
                    topic = matchedNonSocial;
                } else if (isEnglish) {
                    const inferred = inferEnglishTopicFromText(rawTopic);
                    if (inferred) {
                        topic = inferred;
                    } else if ((isGenericWeaknessTopic(rawTopic) || !isSpecificEnglishTopic(rawTopic)) && currentBaseTopics.length > 0) {
                        topic = currentBaseTopics[Math.min(index, currentBaseTopics.length - 1)];
                    } else if (matchedCovered) {
                        topic = formatTopicWithDomain(matchedCovered, subjectCategory, schoolStage);
                    }
                } else if (isJapanese) {
                    const inferred = inferJapaneseTopicFromText(rawTopic, schoolStage);
                    if (inferred) {
                        topic = inferred;
                    } else if ((isGenericWeaknessTopic(rawTopic) || !isSpecificJapaneseTopic(rawTopic)) && currentBaseTopics.length > 0) {
                        topic = currentBaseTopics[Math.min(index, currentBaseTopics.length - 1)];
                    } else if (matchedCovered) {
                        topic = formatTopicWithDomain(matchedCovered, subjectCategory, schoolStage);
                    }
                    if (topic && !isJapaneseTopicAllowedByEvidence(topic, japaneseEvidencePool)) {
                        if (currentBaseTopics.length > 0) {
                            topic = currentBaseTopics[Math.min(index, currentBaseTopics.length - 1)];
                        } else {
                            return null;
                        }
                    }
                } else if (isGenericWeaknessTopic(rawTopic) && nonSocialBaseTopics.length > 0) {
                    topic = nonSocialBaseTopics[Math.min(index, nonSocialBaseTopics.length - 1)];
                } else if (matchedCovered) {
                    topic = formatTopicWithDomain(matchedCovered, subjectCategory, schoolStage);
                }
            }

            return { topic, level };
        })
        .filter((w): w is { topic: string; level: "Primary" | "Secondary" } => !!w);

    // Dedup weakness topics. For social subjects, avoid showing the same topic in both levels.
    const deduped = isSocial
        ? Array.from(
            new Map(
                sanitized
                    .sort((a, b) => (a.level === "Primary" ? -1 : 1) - (b.level === "Primary" ? -1 : 1))
                    .map((w) => [canonicalTopic(w.topic), w] as const)
            ).values()
        )
        : Array.from(
            new Map(
                sanitized.map((w) => [`${canonicalTopic(w.topic)}::${w.level}`, w] as const)
            ).values()
        );

    if (isScience && deduped.length === 0 && coveredTopics.length > 0) {
        const formattedCovered = Array.from(
            new Map(
                (nonSocialBaseTopics.length > 0 ? nonSocialBaseTopics : coveredDomainTopics)
                    .filter(Boolean)
                    .map((t) => [canonicalTopic(t), t] as const)
            ).values()
        );
        return {
            coveredTopics: formattedCovered,
            weaknessAreas: [
                { topic: formattedCovered[0], level: "Primary" },
                ...(formattedCovered[1] ? [{ topic: formattedCovered[1], level: "Secondary" as const }] : [])
            ]
        };
    }

    const formattedCoveredTopics = Array.from(
        new Map(
            (
                isSocial
                    ? socialBaseTopics
                    : isEnglish
                        ? (englishBaseTopics.length > 0 ? englishBaseTopics : coveredDomainTopics)
                        : isJapanese
                            ? (japaneseBaseTopics.length > 0 ? japaneseBaseTopics : coveredDomainTopics)
                        : (nonSocialBaseTopics.length > 0 ? nonSocialBaseTopics : coveredDomainTopics)
            )
                .map((t) => (isSocial ? t : formatTopicWithDomain(t, subjectCategory, schoolStage)))
                .filter((t) => !isLowValueTopic(t, subjectCategory))
                .filter(Boolean)
                .map((t) => [canonicalTopic(t), t] as const)
        ).values()
    );
    const formattedWeaknesses = Array.from(
        new Map(
            deduped
                .map((w) => ({
                    topic: formatTopicWithDomain(w.topic, subjectCategory, schoolStage),
                    level: w.level
                }))
                .filter((w) => !!w.topic && !isLowValueTopic(w.topic, subjectCategory))
                .map((w) => [`${canonicalTopic(w.topic)}::${w.level}`, w] as const)
        ).values()
    );
    const socialSpecificWeaknesses = isSocial
        ? buildPrioritizedSocialWeaknesses(wrongTopics, socialBaseTopics, schoolStage)
        : [];

    const finalCoveredTopics = formattedCoveredTopics.length > 0
        ? formattedCoveredTopics
        : Array.from(
            new Map(
                formattedWeaknesses
                    .map((w) => w.topic)
                    .filter((t) => !!t && !isLowValueTopic(t, subjectCategory))
                    .map((t) => [canonicalTopic(t), t] as const)
            ).values()
        );

    if (subjectCategory === "english" && finalCoveredTopics.length === 0) {
        return {
            coveredTopics: ["文章読解（内容理解）", "文法（基本）"],
            weaknessAreas: formattedWeaknesses
        };
    }
    if (subjectCategory === "japanese" && formattedWeaknesses.length === 0 && finalCoveredTopics.length > 0) {
        return {
            coveredTopics: finalCoveredTopics,
            weaknessAreas: [
                { topic: finalCoveredTopics[0], level: "Primary" },
                ...(finalCoveredTopics[1] ? [{ topic: finalCoveredTopics[1], level: "Secondary" as const }] : [])
            ]
        };
    }

    if (isSocial && socialSpecificWeaknesses.length > 0) {
        const [first, ...rest] = socialSpecificWeaknesses;
        const related = rest.slice(0, 4).map((item) => ({ topic: item.topic, level: "Secondary" as const }));
        return {
            coveredTopics: finalCoveredTopics,
            weaknessAreas: [{ topic: first.topic, level: "Primary" }, ...related.slice(0, Math.max(3, related.length))],
        };
    }

    if (isSocial && preferCivics) {
        const civicsWeaknesses = formattedWeaknesses.filter((w) => isCivicsKeyword(w.topic) || w.topic.startsWith("公民："));
        if (civicsWeaknesses.length > 0) {
            const [first, ...rest] = civicsWeaknesses;
            const primaryFirst = { topic: first.topic, level: "Primary" as const };
            const secondaryRest = rest.map((w) => ({ topic: w.topic, level: "Secondary" as const }));
            return {
                coveredTopics: finalCoveredTopics,
                weaknessAreas: [primaryFirst, ...secondaryRest].slice(0, 3),
            };
        }
    }

    return { coveredTopics: finalCoveredTopics, weaknessAreas: formattedWeaknesses };
}

function limitWeaknessByMistakeDensity(
    weaknessAreas: { topic: string; level: "Primary" | "Secondary" }[],
    markCounts?: AnalysisResult["mark_counts"]
): { topic: string; level: "Primary" | "Secondary" }[] {
    if (!Array.isArray(weaknessAreas) || weaknessAreas.length <= 1) return weaknessAreas;
    const crosses = Number(markCounts?.crosses || 0);
    const slashes = Number(markCounts?.slashes || 0);
    const triangles = Number(markCounts?.triangles || 0);
    const unmarked = Number(markCounts?.unmarked_questions || 0);
    const totalObserved = crosses + slashes + triangles + unmarked + Number(markCounts?.circles || 0);
    if (totalObserved <= 0) {
        // No reliable mark-count signal -> keep model/topic-based output as-is.
        return weaknessAreas;
    }
    const weightedMistakeSignals = crosses + slashes + Math.ceil(triangles * 0.5) + unmarked;

    // Careless-miss pattern: keep one clear focus instead of forcing multiple themes.
    if (weightedMistakeSignals <= 2) {
        const primary = weaknessAreas.find((w) => w.level === "Primary");
        return [primary ?? weaknessAreas[0]];
    }
    return weaknessAreas;
}

function expandWeaknessAreasForLowMastery(
    weaknessAreas: { topic: string; level: "Primary" | "Secondary" }[],
    coveredTopics: string[],
    category: SubjectCategory,
    markCounts?: AnalysisResult["mark_counts"]
): { topic: string; level: "Primary" | "Secondary" }[] {
    if (category !== "english" && category !== "japanese" && category !== "social") return weaknessAreas;

    const crosses = Number(markCounts?.crosses || 0);
    const slashes = Number(markCounts?.slashes || 0);
    const triangles = Number(markCounts?.triangles || 0);
    const unmarked = Number(markCounts?.unmarked_questions || 0);
    const weightedMistakeSignals = crosses + slashes + Math.ceil(triangles * 0.5) + unmarked;

    let targetCount = 2;
    if (weightedMistakeSignals >= 8) targetCount = 5;
    else if (weightedMistakeSignals >= 6) targetCount = 4;
    else if (weightedMistakeSignals >= 4) targetCount = 3;
    if (category === "japanese" || category === "english" || category === "social") {
        targetCount = Math.max(targetCount, 4);
    }

    const japaneseClusterPriority = (topic: string) => {
        if (/^(助詞|助動詞|指示語|接続語|敬語|主語・述語の関係|修飾・被修飾の関係|文の組み立て|言葉の単位)$/.test(topic)) return 0;
        if (/^(四字熟語|故事成語|慣用句|対義語|類義語|同音異義語|同訓異字|熟字訓|送りがな|音読訓読)$/.test(topic)) return 1;
        if (/^(漢文の読み方|返り点|再読文字|受身形|使役形|疑問形|反語形|仮定形|論語|枕草子|徒然草|平家物語|竹取物語|古今和歌集|万葉集|新古今和歌集|奥の細道|高瀬舟|故郷|俳句|短歌|詩)$/.test(topic)) return 2;
        return 3;
    };
    const japaneseInClusterPriority = new Map<string, number>([
        ["助詞", 0],
        ["助動詞", 1],
        ["指示語", 2],
        ["接続語", 3],
        ["敬語", 4],
        ["主語・述語の関係", 5],
        ["修飾・被修飾の関係", 6],
        ["文の組み立て", 7],
        ["言葉の単位", 8],
        ["四字熟語", 20],
        ["故事成語", 21],
        ["慣用句", 22],
        ["対義語", 23],
        ["類義語", 24],
        ["同音異義語", 25],
        ["同訓異字", 26],
        ["熟字訓", 27],
        ["送りがな", 28],
        ["音読訓読", 29],
        ["漢文の読み方", 40],
        ["返り点", 41],
        ["再読文字", 42],
        ["受身形", 43],
        ["使役形", 44],
        ["疑問形", 45],
        ["反語形", 46],
        ["仮定形", 47],
        ["論語", 48],
        ["枕草子", 49],
        ["徒然草", 50],
        ["平家物語", 51],
        ["竹取物語", 52],
        ["古今和歌集", 53],
        ["万葉集", 54],
        ["新古今和歌集", 55],
        ["奥の細道", 56],
        ["高瀬舟", 57],
        ["故郷", 58],
        ["俳句", 59],
        ["短歌", 60],
        ["詩", 61],
    ]);
    const sortTopics = (items: { topic: string; level: "Primary" | "Secondary" }[]) => {
        if (category !== "japanese") return items;
        return [...items].sort((a, b) => {
            if (a.level !== b.level) return a.level === "Primary" ? -1 : 1;
            const ac = japaneseClusterPriority(a.topic);
            const bc = japaneseClusterPriority(b.topic);
            if (ac !== bc) return ac - bc;
            const ap = japaneseInClusterPriority.get(a.topic) ?? 999;
            const bp = japaneseInClusterPriority.get(b.topic) ?? 999;
            if (ap !== bp) return ap - bp;
            return a.topic.localeCompare(b.topic, "ja");
        });
    };

    const existing = new Set(weaknessAreas.map((w) => canonicalTopic(w.topic)));
    const additions = coveredTopics
        .filter((t) => !!t)
        .filter((t) => !isLowValueTopic(t, category))
        .filter((t) => !existing.has(canonicalTopic(t)))
        .slice(0, Math.max(0, targetCount - weaknessAreas.length))
        .map((topic) => ({ topic, level: "Secondary" as const }));

    const merged = Array.from(
        new Map(
            [...weaknessAreas, ...additions]
                .map((w) => [canonicalTopic(w.topic), w] as const)
        ).values()
    );
    const sorted = sortTopics(merged);
    const primary = sorted.find((w) => w.level === "Primary") ?? sorted[0];
    const secondary = sorted
        .filter((w) => canonicalTopic(w.topic) !== canonicalTopic(primary.topic))
        .map((w) => ({ topic: w.topic, level: "Secondary" as const }));

    const guaranteedSecondary = secondary.slice(0, Math.min(4, Math.max(3, targetCount - 1)));
    return [{ topic: primary.topic, level: "Primary" }, ...guaranteedSecondary];
}

async function extractEnglishSpecificTopics(
    answerSheets: { buffer: Buffer; mimeType: string }[],
    problemSheets?: { buffer: Buffer; mimeType: string }[]
): Promise<string[]> {
    const prompt = [
        "あなたは中学英語の単元抽出器です。",
        "答案用紙と問題用紙を見て、誤答または部分点に関係する具体的な単元名を3〜6件だけ JSON で返してください。",
        "抽象語は禁止です。『文法』『語彙』『読解』『表現』だけで終わる出力は禁止。",
        "本文の話題語は禁止です。『スポーツ』『祖母』『京都』『バディベンチ』のような内容語は出力しないでください。",
        "単元名の例: 『三人称単数現在形（肯定文）』『SVOC（C=形容詞）』『want / try / need など + to』『接続詞 because』『疑問詞 + to』『現在完了形（継続用法）』『関係代名詞 who』",
        "出力形式: {\"topics\":[\"単元1\",\"単元2\"]}",
    ].join("\n");

    const userContent: OpenAI.Chat.ChatCompletionContentPart[] = [{ type: "text", text: prompt }];
    for (const sheet of answerSheets) {
        userContent.push({
            type: "image_url",
            image_url: { url: `data:${sheet.mimeType};base64,${sheet.buffer.toString("base64")}` }
        });
    }
    for (const sheet of problemSheets || []) {
        userContent.push({
            type: "image_url",
            image_url: { url: `data:${sheet.mimeType};base64,${sheet.buffer.toString("base64")}` }
        });
    }

    try {
        const response = await runOpenAIWithRetry(() =>
            openai.chat.completions.create({
                model: "gpt-4o-mini",
                messages: [
                    { role: "system", content: "中学英語の具体単元のみを抽出する。JSON以外は返さない。" },
                    { role: "user", content: userContent }
                ],
                response_format: { type: "json_object" },
                temperature: 0.1,
                top_p: 0.1,
            }, {
                timeout: 120000,
            })
        );
        const content = response.choices[0].message.content;
        if (!content) return [];
        const parsed = JSON.parse(content) as { topics?: string[] };
        return Array.from(
            new Map(
                (Array.isArray(parsed.topics) ? parsed.topics : [])
                    .map((t) => inferEnglishTopicFromText(String(t || "")) || resolveEnglishCurriculumUnit(String(t || "")) || toEnglishDomainTopic(String(t || "")))
                    .filter(Boolean)
                    .filter(isSpecificEnglishTopic)
                    .map((t) => [canonicalTopic(t), t] as const)
            ).values()
        ).slice(0, 6);
    } catch {
        return [];
    }
}

async function extractJapaneseSpecificTopics(
    answerSheets: { buffer: Buffer; mimeType: string }[],
    problemSheets?: { buffer: Buffer; mimeType: string }[],
    schoolStage?: SchoolStage | null
): Promise<string[]> {
    const prompt = [
        "あなたは国語の単元抽出器です。",
        "答案用紙と問題用紙を見て、誤答または部分点に関係する具体的な単元名を3〜6件だけ JSON で返してください。",
        "抽象語は禁止です。『論理性』『表現力』『読解』だけで終わる出力は禁止。",
        "設問や出題意図に明示されていない限り、『指示語』を安易に出力してはいけません。",
        "単元名の例: 『接続語』『助詞』『助動詞』『敬語』『四字熟語』『枕草子』『徒然草』『論語』『返り点』『漢文の読み方』。",
        "作品本文が問われている場合は、作品名や古典分野名を優先してください。",
        "出力形式: {\"topics\":[\"単元1\",\"単元2\"]}",
    ].join("\n");

    const userContent: OpenAI.Chat.ChatCompletionContentPart[] = [{ type: "text", text: prompt }];
    for (const sheet of answerSheets) {
        userContent.push({
            type: "image_url",
            image_url: { url: `data:${sheet.mimeType};base64,${sheet.buffer.toString("base64")}` }
        });
    }
    for (const sheet of problemSheets || []) {
        userContent.push({
            type: "image_url",
            image_url: { url: `data:${sheet.mimeType};base64,${sheet.buffer.toString("base64")}` }
        });
    }

    try {
        const response = await runOpenAIWithRetry(() =>
            openai.chat.completions.create({
                model: "gpt-4o-mini",
                messages: [
                    { role: "system", content: "国語の具体単元のみを抽出する。JSON以外は返さない。" },
                    { role: "user", content: userContent }
                ],
                response_format: { type: "json_object" },
                temperature: 0.1,
                top_p: 0.1,
            }, {
                timeout: 120000,
            })
        );
        const content = response.choices[0].message.content;
        if (!content) return [];
        const parsed = JSON.parse(content) as { topics?: string[] };
        const rawTopics = (Array.isArray(parsed.topics) ? parsed.topics : []).map((t) => normalizeTopicLabel(String(t || "")));
        const resolved = rawTopics
            .map((t) => inferJapaneseTopicFromText(String(t || ""), schoolStage) || resolveJapaneseCurriculumUnit(String(t || ""), schoolStage) || toJapaneseDomainTopic(String(t || ""), schoolStage))
            .filter(Boolean)
            .filter(isSpecificJapaneseTopic);
        const filtered = filterJapaneseTopicsByEvidence(resolved, rawTopics);
        return Array.from(
            new Map(
                filtered.map((t) => [canonicalTopic(t), t] as const)
            ).values()
        ).slice(0, 6);
    } catch {
        return [];
    }
}

async function extractSocialSpecificTopics(
    answerSheets: { buffer: Buffer; mimeType: string }[],
    problemSheets?: { buffer: Buffer; mimeType: string }[],
    schoolStage?: SchoolStage | null
): Promise<string[]> {
    const stageLabel = schoolStage === "elementary"
        ? "小学校社会"
        : schoolStage === "middle"
            ? "中学校社会"
            : schoolStage === "high"
                ? "高校社会"
                : "社会";
    const prompt = [
        `あなたは${stageLabel}の単元抽出器です。`,
        "答案用紙と問題用紙を見て、誤答または部分点の設問に関係する具体単元を4〜8件だけ JSON で返してください。",
        "抽出対象は、地理・歴史・公民の単元名だけです。",
        "抽象語は禁止です。『経済発展』『社会問題』『日本』『歴史』『地理』だけで終わる出力は禁止。",
        "活動文や説明文は禁止です。『年表を作る』『調べて発表する』『ポスターにまとめる』のような文は出力しないでください。",
        "できるだけ教科書・カリキュラムの単元名に寄せてください。途中で切れた語やOCR崩れのまま返さないでください。",
        "出力形式: {\"topics\":[\"地理：世界各地の人々の生活と環境\",\"歴史：明治政府の成立と維新\"]}",
    ].join("\n");

    const userContent: OpenAI.Chat.ChatCompletionContentPart[] = [{ type: "text", text: prompt }];
    for (const sheet of answerSheets) {
        userContent.push({
            type: "image_url",
            image_url: { url: `data:${sheet.mimeType};base64,${sheet.buffer.toString("base64")}` }
        });
    }
    for (const sheet of problemSheets || []) {
        userContent.push({
            type: "image_url",
            image_url: { url: `data:${sheet.mimeType};base64,${sheet.buffer.toString("base64")}` }
        });
    }

    try {
        const response = await runOpenAIWithRetry(() =>
            openai.chat.completions.create({
                model: "gpt-4o-mini",
                messages: [
                    { role: "system", content: "社会の具体単元のみを抽出する。JSON以外は返さない。" },
                    { role: "user", content: userContent }
                ],
                response_format: { type: "json_object" },
                temperature: 0.1,
                top_p: 0.1,
            }, {
                timeout: 120000,
            })
        );
        const content = response.choices[0].message.content;
        if (!content) return [];
        const parsed = JSON.parse(content) as { topics?: string[] };
        return Array.from(
            new Map(
                (Array.isArray(parsed.topics) ? parsed.topics : [])
                    .map((t) => normalizeTopicLabel(String(t || "")))
                    .filter((t) => !!t && !isPlaceholderUnit(t))
                    .map((t) => inferSocialTopicFromText(t, schoolStage) || resolveSocialCurriculumUnit(t, schoolStage) || toSocialDomainTopic(t, schoolStage) || "")
                    .filter(Boolean)
                    .filter((t) => !isLowValueUnit(t, "social"))
                    .filter((t) => {
                        const { unit } = splitSocialDomainTopic(t);
                        return getEligibleSocialCurriculumUnits(schoolStage).some((entry) => canonicalTopic(entry.unit) === canonicalTopic(unit));
                    })
                    .map((t) => [canonicalTopic(t), t] as const)
            ).values()
        ).slice(0, 8);
    } catch {
        return [];
    }
}

export async function analyzeImage(
    answerSheets: { buffer: Buffer; mimeType: string }[],
    context?: {
        unitName?: string;
        subject?: string;
        grade?: string;
        problemSheets?: { buffer: Buffer; mimeType: string }[];
        examPhase?: boolean;
    }
): Promise<AnalysisResult> {
    try {
        const userContent: OpenAI.Chat.ChatCompletionContentPart[] = [
            {
                type: "text",
                text: `採点結果を分析し、JSON形式で出力せよ。\n` +
                    (context?.unitName ? `注力単元: ${context.unitName}\n` : "") +
                    `教科: ${context?.subject || "不明"}\n` +
                    (context?.unitName ? `注力単元: ${context.unitName}\n` : "") +
                    `構成: 最初の${answerSheets.length}枚が答案用紙、続く${context?.problemSheets?.length || 0}枚が問題用紙である。`
            }
        ];

        // 答案用紙
        for (const sheet of answerSheets) {
            userContent.push({
                type: "image_url",
                image_url: { url: `data:${sheet.mimeType};base64,${sheet.buffer.toString("base64")}` }
            });
        }

        // 問題用紙
        if (context?.problemSheets) {
            for (const sheet of context.problemSheets) {
                userContent.push({
                    type: "image_url",
                    image_url: { url: `data:${sheet.mimeType};base64,${sheet.buffer.toString("base64")}` }
                });
            }
        }

        const response = await runOpenAIWithRetry(() =>
            openai.chat.completions.create({
                model: "gpt-4o-mini",
                messages: [
                    { role: "system", content: SYSTEM_PROMPT },
                    { role: "user", content: userContent }
                ],
                response_format: { type: "json_object" },
                temperature: 0.2,
                top_p: 0.1,
            }, {
                timeout: 120000,
            })
        );

        const content = response.choices[0].message.content;
        if (!content) throw new Error("No content received");

        const parsed = JSON.parse(content) as AnalysisResult;

        // Subject-specific vocabulary guard to avoid math terms leaking into non-math subjects.
        const subject = (context?.subject || "").toLowerCase();
        const subjectCategory = detectSubjectCategory(subject);
        const isMath = subject.includes("数学");
        const isJapanese = subject.includes("国語");
        const isEnglish = subject.includes("英語");
        const isSocial = subjectCategory === "social" || /社会|地理|歴史|公民|social|geography|history|civics/.test(subject);
        const forbiddenTerms = isMath
            ? []
            : ["途中式", "計算", "代数", "展開", "符号", "方程式", "関数"];

        const replaceForbidden = (text: string) => {
            if (!text) return text;
            let t = text;
            for (const term of forbiddenTerms) {
                if (t.includes(term)) {
                    if (isJapanese) {
                        t = t.replaceAll(term, "文脈");
                    } else if (isEnglish) {
                        t = t.replaceAll(term, "語彙/文法");
                    } else {
                        t = t.replaceAll(term, "内容");
                    }
                }
            }
            return t;
        };

        if (parsed.insight_bullets) {
            parsed.insight_bullets = parsed.insight_bullets.map(replaceForbidden);
        }
        if (parsed.insight_conclusion) {
            parsed.insight_conclusion = replaceForbidden(parsed.insight_conclusion);
        }
        const schoolStage = inferSchoolStageFromGradeLabel(context?.grade);

        if (isEnglish) {
            const extractedEnglishTopics = await extractEnglishSpecificTopics(answerSheets, context?.problemSheets);
            if (extractedEnglishTopics.length > 0) {
                parsed.covered_topics = Array.from(new Set([...(parsed.covered_topics || []), ...extractedEnglishTopics]));
                parsed.wrong_question_topics = Array.from(new Set([...(parsed.wrong_question_topics || []), ...extractedEnglishTopics]));
            }
        }
        if (isJapanese) {
            const extractedJapaneseTopics = await extractJapaneseSpecificTopics(answerSheets, context?.problemSheets, schoolStage);
            if (extractedJapaneseTopics.length > 0) {
                parsed.covered_topics = Array.from(new Set([...(parsed.covered_topics || []), ...extractedJapaneseTopics]));
                parsed.wrong_question_topics = Array.from(new Set([...(parsed.wrong_question_topics || []), ...extractedJapaneseTopics]));
            }
        }
        if (isSocial) {
            const extractedSocialTopics = await extractSocialSpecificTopics(answerSheets, context?.problemSheets, schoolStage);
            if (extractedSocialTopics.length > 0) {
                parsed.covered_topics = Array.from(
                    new Map(
                        [...extractedSocialTopics, ...(parsed.covered_topics || [])]
                            .map((topic) => [canonicalTopic(topic), topic] as const)
                    ).values()
                );
                parsed.wrong_question_topics = Array.from(
                    new Map(
                        [...extractedSocialTopics, ...(parsed.wrong_question_topics || [])]
                            .map((topic) => [canonicalTopic(topic), topic] as const)
                    ).values()
                );
            }
        }

        const finalizeTopicAndWeakness = () => {
            const normalized = sanitizeWeaknessAreas(
                parsed.weakness_areas as WeaknessArea[] | undefined,
                parsed.covered_topics,
                subject,
                parsed.wrong_question_topics,
                schoolStage
            );
            parsed.covered_topics = normalized.coveredTopics;
            parsed.weakness_areas = expandWeaknessAreasForLowMastery(
                limitWeaknessByMistakeDensity(normalized.weaknessAreas, parsed.mark_counts),
                normalized.coveredTopics,
                subjectCategory,
                parsed.mark_counts
            );
        };

        // Ensure exam_phase is always explicit in responses.
        parsed.exam_phase = !!context?.examPhase;

        // Score detection (priority): parse OCR text snippet from answer sheet header.
        const normalizeScore = (s: string) => {
            const m = s.match(/(\d{1,3})/);
            if (!m) return null;
            const n = parseInt(m[1], 10);
            if (!Number.isFinite(n)) return null;
            return `${n}/100`;
        };
        const detectFromText = (t: string) => {
            if (!t) return null;
            // Must include "あなたの得点" or "得点" then a number nearby.
            const patterns = [
                /あなたの得点[^0-9]{0,8}(\d{1,3})\s*点?/,
                /得点[^0-9]{0,8}(\d{1,3})\s*点?/,
                /(\d{1,3})\s*点?\s*[^0-9]{0,4}得点/
            ];
            for (const re of patterns) {
                const m = t.match(re);
                if (m?.[1]) return normalizeScore(m[1]);
            }
            return null;
        };
        const detectedScoreText = parsed.detected_score_text ?? "";
        const detectedRawScore = detectFromText(detectedScoreText);
        const scoreFromHeader = !!detectedRawScore;
        if (detectedRawScore) {
            parsed.raw_test_score = detectedRawScore;
        }

        // Physical Count Mode:
        // Base accuracy from mark counts, plus a bounded reliability adjustment.
        // If accuracy < 40, comprehension must equal accuracy (hard cap).
        const counts = parsed.mark_counts || { circles: 0, triangles: 0, crosses: 0, slashes: 0, unmarked_questions: 0 };
        const circles = Number(counts.circles || 0);
        const triangles = Number(counts.triangles || 0);
        const crosses = Number(counts.crosses || 0);
        const slashes = Number(counts.slashes || 0);
        const unmarked = Number(counts.unmarked_questions || 0);
        const total = circles + triangles + crosses + slashes + unmarked;

        const isLanguageSubject = isJapanese || isEnglish;

        const triangleWeight = isLanguageSubject ? 0.75 : 0.5;
        let score = 0;
        if (total > 0) {
            score = Math.floor(((circles + triangles * triangleWeight) / total) * 100);
        }

        let questionAccuracy = Math.max(0, Math.min(100, score));
        const parseScore = (raw: unknown) => {
            if (typeof raw === "number") return { score: raw, max: parsed.max_score ?? 100 };
            if (typeof raw !== "string") return { score: NaN, max: parsed.max_score ?? 100 };
            const parts = raw.split("/");
            const scorePart = parseFloat(parts[0]);
            const maxPart = parts.length > 1 ? parseFloat(parts[1]) : NaN;
            const max = Number.isFinite(maxPart) ? maxPart : (parsed.max_score ?? 100);
            return { score: scorePart, max };
        };
        const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
        // Prefer raw_test_score from OCR; fallback to test_score for compatibility.
        parsed.raw_test_score = parsed.raw_test_score ?? parsed.test_score;
        const parsedScore = parseScore(parsed.raw_test_score);
        let hasRawScore =
            typeof parsed.raw_test_score === "string" &&
            parsed.raw_test_score !== "" &&
            parsed.raw_test_score !== "不明" &&
            Number.isFinite(parsedScore.score) &&
            Number.isFinite(parsedScore.max) &&
            parsedScore.max > 0 &&
            parsedScore.score <= parsedScore.max;
        if (hasRawScore && parsedScore.score > parsedScore.max) {
            hasRawScore = false;
        }
        if (hasRawScore && !scoreFromHeader) {
            const fullPoint = 1;
            const partialPoint = triangleWeight;
            const maxPossible = circles * fullPoint + triangles * partialPoint;
            const tolerance = 1;
            if (parsedScore.score > maxPossible + tolerance) {
                hasRawScore = false;
            }
        }
        const scoreAccuracy = hasRawScore
            ? clamp(Math.floor((parsedScore.score / parsedScore.max) * 100), 0, 100)
            : NaN;
        if (total <= 0 && Number.isFinite(scoreAccuracy)) {
            questionAccuracy = scoreAccuracy;
        }

        parsed.provisional = !hasRawScore;

        console.log("=== SCORE DEBUG (pre-block) ===", {
            detectedScoreText,
            raw_test_score: parsed.raw_test_score,
            test_score: parsed.test_score,
            hasRawScore,
            scoreAccuracy,
            questionAccuracy,
            examPhase: context?.examPhase,
            provisional: parsed.provisional,
        });

        if (context?.examPhase && !hasRawScore) {
            parsed.provisional = true;
            parsed.comprehension_score = 0;
            parsed.comprehension_details.accuracy = 0;
            parsed.comprehension_details.question_accuracy = questionAccuracy;
            parsed.comprehension_details.process = 0;
            parsed.comprehension_details.consistency = 0;
            parsed.insight_bullets = [];
            parsed.insight_conclusion =
                "評価不能（受験期モードでは得点検出が必須です）。";
            parsed.raw_test_score = parsed.raw_test_score ?? undefined;
            finalizeTopicAndWeakness();
            return parsed;
        }
        const aiProc = Number(parsed?.comprehension_details?.process ?? scoreAccuracy);
        const aiCons = Number(parsed?.comprehension_details?.consistency ?? scoreAccuracy);

        let proc = Number.isFinite(scoreAccuracy) ? scoreAccuracy : questionAccuracy;
        let cons = Number.isFinite(scoreAccuracy) ? scoreAccuracy : questionAccuracy;
        if ((Number.isFinite(scoreAccuracy) ? scoreAccuracy : questionAccuracy) >= 30) {
            if (isLanguageSubject) {
                const base = Number.isFinite(scoreAccuracy) ? scoreAccuracy : questionAccuracy;
                proc = clamp(aiProc, base - 5, base + 15);
                cons = clamp(aiCons, base - 5, base + 10);
            } else {
                const base = Number.isFinite(scoreAccuracy) ? scoreAccuracy : questionAccuracy;
                proc = clamp(aiProc, base - 5, base + 5);
                cons = clamp(aiCons, base - 5, base + 5);
            }
        }

        // Consistency caps: stability cannot exceed question stability (normal), and is score-bounded in exam mode.
        cons = context?.examPhase && Number.isFinite(scoreAccuracy)
            ? Math.min(cons, scoreAccuracy)
            : Math.min(cons, questionAccuracy + 10);
        if (hasRawScore) {
            if (scoreAccuracy < 40) {
                cons = Math.min(cons, 40);
            }
            if (scoreAccuracy < 30) {
                cons = Math.min(cons, 25);
            }
            if (context?.examPhase) {
                cons = Math.min(cons, scoreAccuracy);
            }
        }

        let recomputed = 0;
        if (!hasRawScore) {
            // Provisional mode: no test score provided.
            recomputed = Math.floor(questionAccuracy * 0.6 + proc * 0.4);
            parsed.comprehension_score = clamp(recomputed, 0, 60);
            parsed.comprehension_details.accuracy = questionAccuracy;
            parsed.provisional = true;
        } else {
            const adjustment = clamp(
                (questionAccuracy - scoreAccuracy) * 0.4 +
                (proc - scoreAccuracy) * 0.4 +
                (cons - scoreAccuracy) * 0.2,
                -15,
                15
            );
            if (scoreAccuracy < 40) {
                parsed.comprehension_score = scoreAccuracy;
            } else {
                recomputed = Math.floor(scoreAccuracy + adjustment);
                parsed.comprehension_score = Math.max(0, Math.min(100, recomputed));
            }
            parsed.comprehension_details.accuracy = scoreAccuracy;
            parsed.provisional = false;
        }
        parsed.comprehension_details.question_accuracy = questionAccuracy;
        parsed.comprehension_details.process = proc;
        parsed.comprehension_details.consistency = cons;

        console.log({
            detectedScoreText,
            raw_test_score: parsed.raw_test_score,
            test_score: parsed.test_score,
            hasRawScore,
            scoreAccuracy,
            questionAccuracy,
            examPhase: context?.examPhase,
            provisional: parsed.provisional,
        });

        // Perfect score guard: no fabricated mistakes.
        const isPerfect = total > 0 && (crosses + slashes + unmarked + triangles) === 0;
        if (isPerfect) {
            parsed.insight_bullets = [];
            parsed.insight_conclusion = "満点です。次は応用問題で「解法の多様性」や「説明の丁寧さ」に挑戦しましょう。";
        }

        if (hasRawScore && context?.examPhase && scoreAccuracy <= 40) {
            parsed.comprehension_score = scoreAccuracy;
            parsed.comprehension_details.process = Math.min(proc, scoreAccuracy + 5);
            parsed.comprehension_details.consistency = scoreAccuracy;
        }

        if (hasRawScore && scoreAccuracy <= 25) {
            parsed.comprehension_score = scoreAccuracy;
            parsed.insight_conclusion = context?.examPhase
                ? "この得点帯では「安定感」は評価対象にならない。基礎問題を確実に得点できる状態まで戻す必要がある。"
                : "基礎理解が著しく不足している。まずは基本問題の解き直しから着手する必要がある。";
            finalizeTopicAndWeakness();
            return parsed;
        }

        // Hard-line message for very low scores.
        if (!isPerfect && parsed.comprehension_score <= 30) {
            parsed.insight_conclusion = "非常に深刻な状態です。基礎が完全に欠如しており、このままでは合格は不可能です。";
        }

        // Deterministic comment matrix to reduce drift (score accuracy x question accuracy).
        // Note: Do not use comprehension_score to choose comments.
        if (!isPerfect && hasRawScore) {
            const highScore = scoreAccuracy >= 70;
            const lowScore = scoreAccuracy < 50;
            const highQ = questionAccuracy >= 65;
            const lowQ = questionAccuracy < 45;

            if (lowScore && highQ) {
                parsed.insight_conclusion = "考えようとはしているが知識が不足している。基礎事項の整理が必要。";
            } else if (highScore && lowQ) {
                parsed.insight_conclusion = "点は取れているが理解が断片的。再現性を意識して根拠の確認を。";
            } else if (highScore && highQ) {
                parsed.insight_conclusion = "安定した理解が見られる。知識と設問対応の両面が噛み合っている。";
            } else if (lowScore && lowQ) {
                parsed.insight_conclusion = "基礎理解が不十分。基本事項の反復と解き直しが最優先。";
            }
        }

        finalizeTopicAndWeakness();
        return parsed;
    } catch (error) {
        console.error("OpenAI Analysis Error:", serializeOpenAIError(error));
        throw error;
    }
}
