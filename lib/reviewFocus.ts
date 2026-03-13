import { detectSubjectCategory } from "@/lib/subjects";

type MistakeResult = "wrong" | "partial";

export type ReviewFocusSource = {
    subject?: string | null;
    unitName?: string | null;
    coveredTopics?: string[];
    wrongQuestionTopics?: string[];
    questionMistakes?: {
        topic?: string;
        result?: MistakeResult;
        lost_points?: number | null;
        lostPoints?: number | null;
    }[];
    weaknessAreas?: {
        topic?: string;
        level?: string;
    }[];
};

export type ReviewFocusItem = {
    label: string;
    score: number;
};

const ENGLISH_REVIEW_PATTERNS: { label: string; pattern: RegExp }[] = [
    { label: "be動詞", pattern: /be動詞/i },
    { label: "一般動詞", pattern: /一般動詞|動詞の原形/i },
    { label: "助動詞", pattern: /助動詞|can|must|should|may/i },
    { label: "疑問詞", pattern: /疑問詞|who|what|when|where|which|why|how/i },
    { label: "代名詞", pattern: /代名詞|主格|目的格|所有格|所有代名詞/i },
    { label: "前置詞", pattern: /前置詞|in\s|on\s|at\s|for\s|with\s|from\s|to\s/i },
    { label: "接続詞", pattern: /接続詞|because|if|when|that/i },
    { label: "形容詞", pattern: /形容詞|比較級|最上級/i },
    { label: "副詞", pattern: /副詞/i },
    { label: "不定詞", pattern: /不定詞|to\s+[^ ]+/i },
    { label: "動名詞", pattern: /動名詞|v-ing/i },
    { label: "分詞", pattern: /分詞|現在分詞|過去分詞/i },
    { label: "受動態", pattern: /受動態|be\s+pp/i },
    { label: "現在完了", pattern: /現在完了|have\s+pp/i },
    { label: "関係代名詞", pattern: /関係代名詞|which|that|who|whose/i },
    { label: "関係副詞", pattern: /関係副詞|where|when|why/i },
    { label: "時制", pattern: /時制|過去形|現在形|未来形/i },
    { label: "語順", pattern: /語順/i },
];

const MATH_REVIEW_PATTERNS: { label: string; pattern: RegExp }[] = [
    { label: "正負の数", pattern: /正の数|負の数|正負の数/i },
    { label: "文字式", pattern: /文字式/i },
    { label: "式の計算", pattern: /式の計算|多項式/i },
    { label: "展開の公式", pattern: /展開の公式|展開/i },
    { label: "因数分解", pattern: /因数分解/i },
    { label: "一次方程式", pattern: /一次方程式/i },
    { label: "連立方程式", pattern: /連立方程式/i },
    { label: "二次方程式", pattern: /二次方程式/i },
    { label: "比例・反比例", pattern: /比例|反比例/i },
    { label: "一次関数", pattern: /一次関数/i },
    { label: "関数", pattern: /関数/i },
    { label: "平方根", pattern: /平方根|ルート/i },
    { label: "三平方の定理", pattern: /三平方の定理/i },
    { label: "合同", pattern: /合同/i },
    { label: "相似", pattern: /相似/i },
    { label: "円周角", pattern: /円周角/i },
    { label: "作図", pattern: /作図/i },
    { label: "確率", pattern: /確率/i },
    { label: "場合の数", pattern: /場合の数/i },
    { label: "箱ひげ図", pattern: /箱ひげ図/i },
    { label: "平均・中央値", pattern: /平均値|中央値|代表値/i },
    { label: "面積", pattern: /面積/i },
    { label: "体積", pattern: /体積/i },
];

function normalizeText(value: unknown): string {
    return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

function getWeight(result?: MistakeResult, lostPoints?: number | null): number {
    const loss = typeof lostPoints === "number" && Number.isFinite(lostPoints) ? Math.max(0, lostPoints) : 0;
    return (result === "partial" ? 2 : 4) + Math.min(loss, 4);
}

function getPatterns(subject?: string | null) {
    const category = detectSubjectCategory(subject || "");
    if (category === "english") return ENGLISH_REVIEW_PATTERNS;
    if (category === "math") return MATH_REVIEW_PATTERNS;
    return [];
}

function getFallbackTitle(subject?: string | null): string {
    return detectSubjectCategory(subject || "") === "english"
        ? "見直すべき品詞"
        : "見直すべき公式・単元";
}

export function getReviewFocusTitle(subject?: string | null): string {
    const category = detectSubjectCategory(subject || "");
    if (category === "english") return "見直すべき品詞";
    if (category === "math") return "見直すべき公式・単元";
    return "見直すべき項目";
}

export function extractReviewFocus(source: ReviewFocusSource, limit = 5): ReviewFocusItem[] {
    const patterns = getPatterns(source.subject);
    if (patterns.length === 0) return [];

    const weights = new Map<string, number>();
    const bump = (text: string, score: number) => {
        const normalized = normalizeText(text);
        if (!normalized) return;

        let matched = false;
        patterns.forEach(({ label, pattern }) => {
            if (!pattern.test(normalized)) return;
            weights.set(label, (weights.get(label) || 0) + score);
            matched = true;
        });

        if (!matched && score >= 4) {
            weights.set(normalized, (weights.get(normalized) || 0) + Math.max(1, Math.floor(score / 2)));
        }
    };

    (source.questionMistakes || []).forEach((entry) => {
        bump(entry.topic || "", getWeight(entry.result, entry.lost_points ?? entry.lostPoints ?? null));
    });

    (source.wrongQuestionTopics || []).forEach((topic) => bump(topic, 4));
    (source.weaknessAreas || []).forEach((entry) => bump(entry.topic || "", entry.level === "Primary" ? 3 : 2));
    (source.coveredTopics || []).forEach((topic) => bump(topic, 1));
    bump(source.unitName || "", 1);

    return Array.from(weights.entries())
        .sort((a, b) => {
            if (a[1] !== b[1]) return b[1] - a[1];
            return a[0].localeCompare(b[0], "ja");
        })
        .slice(0, limit)
        .map(([label, score]) => ({ label, score }));
}

export function summarizeReviewFocus(source: ReviewFocusSource, limit = 5): string[] {
    return extractReviewFocus(source, limit).map((item) => item.label);
}

export function getReviewFocusFallbackTitle(subject?: string | null): string {
    return getFallbackTitle(subject);
}
