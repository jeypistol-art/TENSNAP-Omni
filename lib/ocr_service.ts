import OpenAI from "openai";

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

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

        const response = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                { role: "system", content: SYSTEM_PROMPT },
                { role: "user", content: userContent }
            ],
            response_format: { type: "json_object" },
            temperature: 0.2,
            top_p: 0.1,
        });

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

        return parsed;
    } catch (error) {
        console.error("OpenAI Analysis Error:", error);
        throw error;
    }
}
