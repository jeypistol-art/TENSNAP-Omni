import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { query } from "@/lib/db";
import { getOpenAIClient, runOpenAIWithRetry, serializeOpenAIError } from "@/lib/openai_client";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type Weakness = { topic?: string; level?: string };
type Details = {
    comprehension_details?: {
        accuracy?: number;
        process?: number;
        consistency?: number;
    };
    comprehension_score?: number;
    weakness_areas?: Weakness[];
    test_date?: string;
    unit_name?: string;
    insight_conclusion?: string;
};
type AnalysisRecord = {
    unit_name: string | null;
    details: Details | string | null;
};

function safeParseJson<T>(value: unknown, fallback: T): T {
    if (value == null) return fallback;
    if (typeof value === "string") {
        try {
            return JSON.parse(value) as T;
        } catch {
            return fallback;
        }
    }
    if (typeof value === "object") return value as T;
    return fallback;
}

export async function GET(request: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const studentId = searchParams.get("studentId");
        const startDate = searchParams.get("startDate");
        const endDate = searchParams.get("endDate");
        const subject = searchParams.get("subject");

        if (!studentId) {
            return NextResponse.json({ error: "Student ID is required" }, { status: 400 });
        }
        if (!UUID_RE.test(studentId)) {
            return NextResponse.json({ error: "Invalid student ID format" }, { status: 400 });
        }

        // Build Query Conditions
        let dateCondition = "";
        const params: unknown[] = [studentId, session.user.id];
        let paramIndex = 3;

        if (startDate) {
            dateCondition += ` AND test_date >= $${paramIndex}`;
            params.push(startDate);
            paramIndex++;
        }
        if (endDate) {
            dateCondition += ` AND test_date <= $${paramIndex}`;
            params.push(endDate);
            paramIndex++;
        }
        if (subject && subject !== "all") {
            dateCondition += ` AND subject = $${paramIndex}`;
            params.push(subject);
            paramIndex++;
        }

        // Fetch Data
        // Order by test_date ASC to determine "Start" vs "Current"
        const result = await query<AnalysisRecord>(
            `SELECT 
                unit_name,
                details 
             FROM analyses 
             WHERE student_id = $1 AND user_id = $2 ${dateCondition}
             ORDER BY test_date ASC, created_at ASC`,
            params
        );

        const records = result.rows.map((r) => ({
            ...r,
            details: safeParseJson<Details>(r.details, {}),
        }));

        if (records.length === 0) {
            return NextResponse.json({
                aggregated: null,
                message: "No records found for this period"
            });
        }

        // --- Aggregation Logic ---

        // 1. Helper to extract stats
        const getStats = (record: { details: Details }) => {
            const d = record.details?.comprehension_details || {};
            return {
                accuracy: d.accuracy || 0,
                process: d.process || 0,
                consistency: d.consistency || 0,
                score: record.details?.comprehension_score || 0
            };
        };

        // 2. Identify "Start" (First Record) and "Current" (Average of all, or Last? Requirement says "Current", usually imply latest state, but "Period Summary" implies average performance.
        // Let's use Last Record as "Current State" and First Record as "Start State" for the Radar Chart comparison "Where you started vs Where you are now".
        // BUT, for the "Period Stats" (averages), we should use the whole period.

        // Let's calculate Period Averages for the simplified stats
        const total = records.length;

        type Stats = { accuracy: number; process: number; consistency: number; score: number };

        const sums = records.reduce<Stats>((acc, r) => {
            const s = getStats(r);
            return {
                accuracy: acc.accuracy + s.accuracy,
                process: acc.process + s.process,
                consistency: acc.consistency + s.consistency,
                score: acc.score + s.score
            };
        }, { accuracy: 0, process: 0, consistency: 0, score: 0 });

        const averages = {
            accuracy: Math.round(sums.accuracy / total),
            process: Math.round(sums.process / total),
            consistency: Math.round(sums.consistency / total),
            score: Math.round(sums.score / total)
        };

        // Radar Chart Data points
        const startRecord = records[0];
        const lastRecord = records[records.length - 1]; // Or should we use average? The prompt says "Current understanding (dark color)" vs "Start understanding (light color)". "Current" usually means NOW.
        // Let's use Last Record for "Current" to show growth from start to finish of the period.
        const startStats = getStats(startRecord);
        const currentStats = getStats(lastRecord);

        // 3. Aggregate Weaknesses
        const weaknessCounts: Record<string, { count: number; units: Set<string> }> = {};
        records.forEach((r) => {
            const weaknesses = Array.isArray(r.details?.weakness_areas) ? r.details.weakness_areas : [];
            weaknesses.forEach((w) => {
                const topic = typeof w?.topic === "string" ? w.topic : "";
                if (!topic) return;
                if (!weaknessCounts[topic]) {
                    weaknessCounts[topic] = { count: 0, units: new Set() };
                }
                weaknessCounts[topic].count += 1;
                // Add unit_name if available
                if (r.unit_name) {
                    weaknessCounts[topic].units.add(r.unit_name);
                }
            });
        });

        // Sort by frequency
        const sortedWeaknesses = Object.entries(weaknessCounts)
            .sort(([, a], [, b]) => b.count - a.count)
            .slice(0, 5) // Top 5
            .map(([topic, data]) => ({
                topic,
                count: data.count,
                units: Array.from(data.units).slice(0, 4) // Convert Set to Array, limit to 4 units
            }));

        // --- AI Summary Generation ---
        const prompt = `
Role: プロの学習塾講師
Context: 保護者面談および生徒へのフィードバック用の「期間集計レポート」。
Task: 指定期間の学習データを基に、生徒の成長を称賛し、かつ次の一手を的確に示す「ワン・センテンス（または2文程度）」の総評を作成せよ。

Data:
- 期間: ${startDate || "全期間"} 〜 ${endDate || "現在"}
- 教科: ${subject && subject !== "all" ? subject : "全教科"}
- 分析回数: ${total}回
- リスト(古い順): 
${records.map((r, i: number) => {
            const d = r.details;
            return `${i + 1}. ${d.test_date || "日付不明"}: ${d.unit_name} (理解度 ${d.comprehension_score}%) - ${d.insight_conclusion}`;
        }).join("\n")}

- 成長推移(Start -> End):
  - 得点理解度: ${startStats.accuracy} -> ${currentStats.accuracy}
  - 思考プロセス: ${startStats.process} -> ${currentStats.process}
  - 安定感: ${startStats.consistency} -> ${currentStats.consistency}

- 頻出弱点: ${sortedWeaknesses.map(w => w.topic).join(", ")}

Output Requirement:
- 「〜が素晴らしい成長を見せました。次は〜を強化しましょう」といった形式で、ポジティブかつ具体的、そしてプロフェッショナルなトーンで。
- 必ず日本語で記述すること。
- 100文字以内で簡潔に。
`;

        let aiSummary = "";
        try {
            const openai = getOpenAIClient();
            const completion = await runOpenAIWithRetry(() =>
                openai.chat.completions.create({
                    model: "gpt-4o-mini",
                    messages: [{ role: "system", content: prompt }],
                    max_tokens: 150,
                })
            );
            aiSummary = completion.choices[0].message.content?.trim() || "";
        } catch (error) {
            console.error("Aggregation Summary OpenAI Error:", serializeOpenAIError(error));
            aiSummary = `期間内に${total}回の分析を実施し、得点理解度${startStats.accuracy}%→${currentStats.accuracy}%へ推移。次は「${sortedWeaknesses[0]?.topic || "基礎の定着"}」を重点強化しましょう。`;
        }

        return NextResponse.json({
            aggregated: {
                totalAnalyses: total,
                averages,
                startStats,
                currentStats, // Last record stats for Radar
                weaknesses: sortedWeaknesses,
                aiSummary
            }
        });

    } catch (error) {
        console.error("Aggregation Error:", {
            requestUrl: request.url,
            error: serializeOpenAIError(error),
        });
        return NextResponse.json({ error: "Failed to aggregate data" }, { status: 500 });
    }
}
