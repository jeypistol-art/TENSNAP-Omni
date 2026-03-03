import type OpenAI from "openai";
import { getOpenAIClient, runOpenAIWithRetry, serializeOpenAIError } from "@/lib/openai_client";
import { detectSubjectCategory, type SubjectCategory } from "@/lib/subjects";

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
   - 「基礎知識」「地理的知識」「歴史的出来事」「地理分野」などの抽象語は禁止。
   - 3〜6件程度、短い名詞句で出力せよ（長文説明は不要）。
   - 特に、誤答（×/斜線）または部分点（△）が付いた設問の内容から語句を優先して抽出せよ。
   - weakness_areas.topic も同様に、誤答・部分点設問の「内容語句」をそのまま短句で記載せよ。
   - wrong_question_topics に、誤答・部分点設問から抽出した語句のみを 2〜6件で出力せよ。

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
    const normalized = normalizeTopicLabel(topic).replace(/：/g, ":");
    const m = normalized.match(/^(地理|歴史|公民)\s*:\s*(.+)$/);
    if (m?.[1] && m?.[2]) {
        const domain = m[1] as "地理" | "歴史" | "公民";
        return { domain, unit: normalizeTopicLabel(m[2]) };
    }
    return { domain: null, unit: normalizeTopicLabel(normalized) };
}

function splitDomainTopic(topic: string): { domain: string | null; unit: string } {
    const normalized = normalizeTopicLabel(topic).replace(/：/g, ":");
    const m = normalized.match(/^([^:]+)\s*:\s*(.+)$/);
    if (m?.[1] && m?.[2]) return { domain: normalizeTopicLabel(m[1]), unit: normalizeTopicLabel(m[2]) };
    return { domain: null, unit: normalizeTopicLabel(normalized) };
}

function inferSocialDomain(unit: string): "地理" | "歴史" | "公民" | null {
    if (!unit) return null;
    if (isCivicsKeyword(unit)) return "公民";
    if (/(時代|戦争|幕府|改革|明治|大正|昭和|平成|令和|縄文|弥生|古墳|飛鳥|奈良|平安|鎌倉|室町|安土桃山|江戸|日清|日露|第一次世界大戦|第二次世界大戦)/.test(unit)) return "歴史";
    if (/(地図|地形|気候|都道府県|地域|地方|平野|盆地|山脈|海流|統計|雨温図|人口|都市|貿易|産業|農業|工業|三大洋|サンフランシスコ|ヒマラヤ|オーストラリア)/.test(unit)) return "地理";
    return null;
}

function inferDomainByCategory(unit: string, category: SubjectCategory): string | null {
    if (!unit) return null;
    switch (category) {
        case "math":
            if (/(方程式|連立方程式|関数|一次関数|二次関数|比例|反比例|式|計算|展開|因数分解|代数|確率|場合の数|図形|合同|相似|三平方|円|角度|面積|体積|整数)/.test(unit)) {
                if (/(図形|合同|相似|三平方|円|角度|面積|体積)/.test(unit)) return "図形";
                if (/(確率|場合の数|データ|統計)/.test(unit)) return "確率・統計";
                return "代数";
            }
            return "数学";
        case "english":
            if (/(文法|時制|受動態|助動詞|不定詞|動名詞|関係代名詞|比較|語順)/.test(unit)) return "文法";
            if (/(読解|長文|本文|内容一致)/.test(unit)) return "読解";
            if (/(語彙|単語|熟語|イディオム)/.test(unit)) return "語彙";
            if (/(英作文|作文|和訳|英訳)/.test(unit)) return "英作文";
            return "英語";
        case "japanese":
            if (/(漢字|語句|語彙|ことわざ|慣用句)/.test(unit)) return "語彙・漢字";
            if (/(文法|品詞|敬語|活用)/.test(unit)) return "文法";
            if (/(読解|説明文|論説文|小説|文学的文章)/.test(unit)) return "読解";
            if (/(古文|漢文)/.test(unit)) return "古文・漢文";
            return "国語";
        case "science":
            if (/(力|運動|電流|電圧|回路|光|音|仕事|エネルギー|圧力)/.test(unit)) return "物理";
            if (/(化学|原子|分子|イオン|中和|酸|アルカリ|気体|水溶液|金属)/.test(unit)) return "化学";
            if (/(生物|細胞|遺伝|生態系|光合成|呼吸|植物|動物)/.test(unit)) return "生物";
            if (/(地層|天気|気象|地震|火山|天体|星|月|地球)/.test(unit)) return "地学";
            return "理科";
        case "social":
            return inferSocialDomain(unit) ?? "社会";
        default:
            return null;
    }
}

function formatTopicWithDomain(topic: string, category: SubjectCategory): string {
    const { domain, unit } = splitDomainTopic(topic);
    if (!unit) return "";

    if (category === "social") {
        return toSocialDomainTopic(topic);
    }

    const resolved = domain || inferDomainByCategory(unit, category);
    return resolved ? `${resolved}：${unit}` : unit;
}

function toSocialDomainTopic(topic: string): string {
    const { domain, unit } = splitSocialDomainTopic(topic);
    if (!unit) return "";
    const resolvedDomain = domain ?? inferSocialDomain(unit);
    return resolvedDomain ? `${resolvedDomain}：${unit}` : `社会：${unit}`;
}

function isGenericWeaknessTopic(topic: string): boolean {
    return /(基礎知識が足りない|応用知識が必要|知識不足|理解不足|基礎の欠如|基礎理解が不十分|課題がある|理解が浅い)/.test(topic);
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

function toSocialDetailedWeakness(baseTopic: string, coveredTopics: string[], index: number): string {
    const normalizedTopic = toSocialDomainTopic(baseTopic);
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
    if (fallback) return toSocialDomainTopic(fallback) || fallback;
    return toSocialDomainTopic(baseTopic) || baseTopic;
}

function toSocialSpecificWeakness(topic: string, coveredTopics: string[], index: number): string {
    return toSocialDetailedWeakness(topic, coveredTopics, index);
}

function extractSocialKeywordSeed(text: string): string {
    return normalizeTopicLabel(text)
        .replace(/^(最優先|関連課題|要確認)\s*/g, "")
        .replace(/(への知識定着|地域の復習|の復習|の理解が乏しい|に弱い|の理解が不十分)$/g, "")
        .trim();
}

function isSpecificSocialKeyword(topic: string): boolean {
    const t = normalizeTopicLabel(topic);
    if (!t || t.length < 2) return false;

    const abstractOnly = /(基礎知識|応用知識|地理的知識|歴史的出来事|歴史的事件|知識|理解|課題|分野|読み取り|復習|応用力|基礎力|思考力|判断力|表現力)/;
    const properHint = /(時代|条約|改革|戦争|内閣|幕府|憲法|地方|地域|都道府県|地形|気候|産業|貿易|平野|盆地|海流|モンスーン|EU|ASEAN|NATO|北海道|東北|関東|中部|近畿|中国|四国|九州|日本|世界|アジア|ヨーロッパ|アフリカ|オセアニア|北アメリカ|南アメリカ|ブラジル|アメリカ|中国|ロシア|インド|江戸|明治|大正|昭和|平成|令和)/;

    if (properHint.test(t)) return true;
    if (abstractOnly.test(t)) return false;
    // Keep short noun-like Japanese terms as fallback when not abstract.
    return /^[\p{sc=Han}\p{sc=Hiragana}\p{sc=Katakana}A-Za-z0-9・\-]{2,20}$/u.test(t);
}

function buildSpecificSocialTopics(coveredTopics: string[], weaknesses: WeaknessArea[]): string[] {
    const pool = [
        ...coveredTopics,
        ...weaknesses.map((w) => String(w?.topic || "")),
    ]
        .map(extractSocialKeywordSeed)
        .map(toSocialDomainTopic)
        .filter(Boolean);

    const specific = pool.filter(isSpecificSocialKeyword);
    const deduped = Array.from(new Map(specific.map((t) => [canonicalTopic(t), t] as const)).values());

    if (deduped.length > 0) return deduped.slice(0, 6);
    return coveredTopics;
}

function mergeSocialTopicPool(wrongTopics: string[], coveredTopics: string[]): string[] {
    const merged = [...wrongTopics, ...coveredTopics]
        .map((t) => normalizeTopicLabel(String(t || "")))
        .map(toSocialDomainTopic)
        .filter(Boolean);
    return Array.from(new Map(merged.map((t) => [canonicalTopic(t), t] as const)).values());
}

function prioritizeCivicsTopics(topics: string[], preferCivics: boolean): string[] {
    if (!preferCivics) return topics;
    const civics = topics.filter((t) => isCivicsKeyword(t) || t.startsWith("公民："));
    const others = topics.filter((t) => !(isCivicsKeyword(t) || t.startsWith("公民：")));
    return [...civics, ...others];
}

function sanitizeWeaknessAreas(
    inputWeaknesses: WeaknessArea[] | undefined,
    inputCoveredTopics: string[] | undefined,
    subject: string,
    wrongQuestionTopics?: string[] | undefined
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
    const isSocial = /社会|地理|歴史|social|geography|history/.test(lowerSubject);
    const subjectCategory = detectSubjectCategory(subject);
    const rawWeaknesses = Array.isArray(inputWeaknesses) ? inputWeaknesses : [];
    const wrongTopics = Array.from(
        new Set(
            (Array.isArray(wrongQuestionTopics) ? wrongQuestionTopics : [])
                .map((t) => normalizeTopicLabel(String(t || "")))
                .map(toSocialDomainTopic)
                .filter(Boolean)
        )
    );
    const preferCivics = isSocial && wrongTopics.some((t) => isCivicsKeyword(t) || t.startsWith("公民："));
    const socialSpecificTopics = isSocial
        ? (
            wrongTopics.length > 0
                ? buildSpecificSocialTopics(mergeSocialTopicPool(wrongTopics, coveredTopics), rawWeaknesses)
                : buildSpecificSocialTopics(coveredTopics, rawWeaknesses)
        )
        : coveredTopics;
    const socialBaseTopics = isSocial && socialSpecificTopics.length > 0
        ? prioritizeCivicsTopics(socialSpecificTopics, preferCivics)
        : coveredTopics;

    const sanitized = rawWeaknesses
        .map((w, index) => {
            const rawTopic = normalizeTopicLabel(String(w?.topic || ""));
            if (!rawTopic) return null;

            const matchedCovered = findCoveredTopicMatch(rawTopic, coveredTopics);
            let topic = rawTopic;
            const level = normalizeWeaknessLevel(w?.level);

            if (isScience) {
                // Science-family: never surface weakness topics outside covered topics.
                if (matchedCovered) {
                    topic = matchedCovered;
                } else if (coveredTopics.length > 0 && isGenericWeaknessTopic(rawTopic)) {
                    topic = coveredTopics[Math.min(index, coveredTopics.length - 1)];
                } else {
                    return null;
                }
            } else if (isSocial) {
                const matchedSocial = findCoveredTopicMatch(rawTopic, socialBaseTopics);
                if (matchedSocial) {
                    topic = toSocialDetailedWeakness(matchedSocial, socialBaseTopics, index);
                } else if (isGenericWeaknessTopic(rawTopic)) {
                    topic = toSocialSpecificWeakness(rawTopic, socialBaseTopics, index);
                } else {
                    topic = toSocialDetailedWeakness(rawTopic, socialBaseTopics, index);
                }
            } else if (matchedCovered) {
                topic = matchedCovered;
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
                coveredTopics
                    .map((t) => formatTopicWithDomain(t, subjectCategory))
                    .filter(Boolean)
                    .map((t) => [canonicalTopic(t), t] as const)
            ).values()
        );
        return {
            coveredTopics: formattedCovered,
            weaknessAreas: [
                { topic: formatTopicWithDomain(coveredTopics[0], subjectCategory), level: "Primary" },
                ...(coveredTopics[1] ? [{ topic: formatTopicWithDomain(coveredTopics[1], subjectCategory), level: "Secondary" as const }] : [])
            ]
        };
    }

    const formattedCoveredTopics = Array.from(
        new Map(
            (isSocial ? socialBaseTopics : coveredTopics)
                .map((t) => formatTopicWithDomain(t, subjectCategory))
                .filter(Boolean)
                .map((t) => [canonicalTopic(t), t] as const)
        ).values()
    );
    const formattedWeaknesses = Array.from(
        new Map(
            deduped
                .map((w) => ({
                    topic: formatTopicWithDomain(w.topic, subjectCategory),
                    level: w.level
                }))
                .filter((w) => !!w.topic)
                .map((w) => [`${canonicalTopic(w.topic)}::${w.level}`, w] as const)
        ).values()
    );

    if (isSocial && preferCivics) {
        const civicsWeaknesses = formattedWeaknesses.filter((w) => isCivicsKeyword(w.topic) || w.topic.startsWith("公民："));
        if (civicsWeaknesses.length > 0) {
            const [first, ...rest] = civicsWeaknesses;
            const primaryFirst = { topic: first.topic, level: "Primary" as const };
            const secondaryRest = rest.map((w) => ({ topic: w.topic, level: "Secondary" as const }));
            return {
                coveredTopics: formattedCoveredTopics,
                weaknessAreas: [primaryFirst, ...secondaryRest].slice(0, 3),
            };
        }
    }

    return { coveredTopics: formattedCoveredTopics, weaknessAreas: formattedWeaknesses };
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

export async function analyzeImage(
    answerSheets: { buffer: Buffer; mimeType: string }[],
    context?: {
        unitName?: string;
        subject?: string;
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
        const isMath = subject.includes("数学");
        const isJapanese = subject.includes("国語");
        const isEnglish = subject.includes("英語");
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

        const finalizeTopicAndWeakness = () => {
            const normalized = sanitizeWeaknessAreas(
                parsed.weakness_areas as WeaknessArea[] | undefined,
                parsed.covered_topics,
                subject,
                parsed.wrong_question_topics
            );
            parsed.covered_topics = normalized.coveredTopics;
            parsed.weakness_areas = limitWeaknessByMistakeDensity(normalized.weaknessAreas, parsed.mark_counts);
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

        const questionAccuracy = Math.max(0, Math.min(100, score));
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
