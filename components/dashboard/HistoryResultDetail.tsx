"use client";

import React, { forwardRef } from "react";

type Weakness = { topic: string; level: string };
type ComprehensionDetails = {
    accuracy: number;
    question_accuracy?: number;
    process: number;
    consistency: number;
};

export type AnalysisDetails = {
    comprehension_score?: number;
    comprehension_details?: ComprehensionDetails;
    insight_bullets?: string[];
    insight_conclusion?: string;
    covered_topics?: string[];
    weakness_areas?: Weakness[];
    raw_test_score?: number | string;
    input_test_score?: number | string;
    exam_phase?: boolean;
    provisional?: boolean;
    test_score_raw?: number | string;
};

export type HistoryResultItem = {
    id: string;
    test_date: string;
    subject: string;
    unit_name: string;
    test_score: number;
    max_score: number;
    comprehension_score: number;
    insight_summary: string;
    weaknesses: Weakness[];
    created_at: string;
    details?: AnalysisDetails;
};

type HistoryResultDetailProps = {
    item: HistoryResultItem;
    studentName: string;
};

const HistoryResultDetail = forwardRef<HTMLDivElement, HistoryResultDetailProps>(({ item, studentName }, ref) => {
    const details = item.details || {};
    const comprehension = Number(item.comprehension_score ?? details?.comprehension_score ?? 0);
    const comprehensionDetails = details?.comprehension_details;
    const examBlocked = !!(details?.exam_phase && details?.provisional && !details?.raw_test_score);

    const insightBullets: string[] = Array.isArray(details?.insight_bullets) ? details.insight_bullets : [];
    const coveredTopics: string[] = Array.isArray(details?.covered_topics)
        ? details.covered_topics
        : item.unit_name
            ? [item.unit_name]
            : [];
    const weaknessAreas: Weakness[] = Array.isArray(details?.weakness_areas) ? details.weakness_areas : (item.weaknesses || []);
    const testDate = new Date(item.test_date || item.created_at).toISOString().split("T")[0];

    return (
        <div ref={ref} className="w-full max-w-4xl bg-white rounded-lg shadow-lg p-6">
            <div className="text-center mb-6">
                <h2 className="text-xl font-bold text-gray-700 tracking-wider">分析結果</h2>

                <div className="flex items-center justify-center mt-6">
                    <div className="text-center">
                        <span className="block text-sm font-bold text-blue-600 mb-2">学習理解度</span>
                        <div className={`text-6xl font-extrabold leading-none ${examBlocked ? "text-gray-300" : "text-blue-600"}`}>
                            {examBlocked ? "—" : comprehension}
                            {!examBlocked && <span className="text-2xl font-bold text-blue-400 ml-1">%</span>}
                        </div>
                        <p className="text-xs text-gray-400 mt-2 font-medium">総合的な習得状態</p>
                    </div>
                </div>

                {(details?.exam_phase === true || details?.raw_test_score !== undefined || details?.test_score_raw !== undefined) && (
                    <div className="mt-3 flex flex-col items-center gap-2">
                        {details?.exam_phase === true && (
                            <span className="inline-flex items-center gap-2 rounded-full bg-red-50 text-red-600 text-[11px] font-bold px-3 py-1 border border-red-200">
                                受験期モードON
                            </span>
                        )}
                        {(details?.test_score_raw !== undefined || details?.raw_test_score !== undefined) && (
                            <p className="text-[11px] text-gray-500">
                                評価対象得点：{String(details?.test_score_raw ?? details?.raw_test_score)}（この数値をもとに理解度を算出しています）
                            </p>
                        )}
                    </div>
                )}

                {examBlocked && (
                    <p className="mt-3 text-xs text-red-500 font-semibold">
                        ⚠ 評価不能（受験期モードでは答案からの得点検出が必須です）
                    </p>
                )}

                {comprehensionDetails && (
                    <div className={`grid grid-cols-2 sm:grid-cols-4 gap-3 mt-8 max-w-3xl mx-auto ${examBlocked ? "opacity-40 grayscale" : ""}`}>
                        <div className="bg-gray-50 p-3 rounded-lg text-center border border-gray-100">
                            <span className="block text-[11px] text-gray-500 font-bold mb-1">得点理解度</span>
                            <span className="text-xl font-bold text-gray-800">{examBlocked ? "—" : `${comprehensionDetails.accuracy}%`}</span>
                        </div>
                        <div className="bg-gray-50 p-3 rounded-lg text-center border border-gray-100">
                            <span className="block text-[11px] text-gray-500 font-bold mb-1">設問安定度</span>
                            <span className="text-xl font-bold text-gray-800">{examBlocked ? "—" : `${comprehensionDetails.question_accuracy ?? comprehensionDetails.accuracy}%`}</span>
                        </div>
                        <div className="bg-gray-50 p-3 rounded-lg text-center border border-gray-100">
                            <span className="block text-[11px] text-gray-500 font-bold mb-1">思考・記述プロセス</span>
                            <span className="text-xl font-bold text-gray-800">{examBlocked ? "—" : `${comprehensionDetails.process}%`}</span>
                        </div>
                        <div className="bg-gray-50 p-3 rounded-lg text-center border border-gray-100">
                            <span className="block text-[11px] text-gray-500 font-bold mb-1">学習の安定感</span>
                            <span className="text-xl font-bold text-gray-800">{examBlocked ? "—" : `${comprehensionDetails.consistency}%`}</span>
                        </div>
                    </div>
                )}

                {comprehensionDetails && (
                    <div className="mt-3 text-center space-y-1">
                        {typeof comprehensionDetails.question_accuracy === "number" &&
                            comprehensionDetails.question_accuracy < comprehensionDetails.accuracy && (
                                <p className="text-[11px] text-gray-500">
                                    ※ 設問ごとの安定度が低いため、得点に比べ理解度が抑えられています
                                </p>
                            )}
                        {details?.provisional === true && (
                            <p className="text-[11px] text-gray-500">
                                ※ 得点情報が未取得のため、理解度は暫定評価です
                            </p>
                        )}
                    </div>
                )}

                <div className="mt-4 mx-auto max-w-md text-[11px] text-gray-400 border-t border-gray-100 pt-3 text-left">
                    <div className="font-semibold text-gray-500 mb-1">採点条件:</div>
                    <div>・raw得点: {details?.raw_test_score ? String(details.raw_test_score) : "—"}</div>
                    <div>・input得点: {details?.input_test_score ? String(details.input_test_score) : "—"}</div>
                    <div>・受験期モード: {details?.exam_phase ? "ON" : "OFF"}</div>
                    <div>・評価区分: {details?.provisional ? "暫定" : "確定"}</div>
                </div>
            </div>

            <div className="space-y-6">
                <div className="bg-blue-50 rounded-lg border border-blue-100 p-6">
                    <span className="block text-blue-700 text-xs font-bold mb-4 tracking-wide">専門的分析インサイト</span>
                    <ul className="space-y-3 mb-5">
                        {(insightBullets.length > 0 ? insightBullets : [item.insight_summary || "詳細な分析はありません"]).map((bullet, i) => (
                            <li key={i} className="flex items-start text-sm text-gray-700 leading-relaxed">
                                <span className="mr-2 text-blue-500 mt-1">•</span>
                                {bullet}
                            </li>
                        ))}
                    </ul>

                    {(details?.insight_conclusion || item.insight_summary) && (
                        <div className="bg-white/80 p-4 rounded-lg border border-blue-100 shadow-sm">
                            <p className="text-sm font-bold text-gray-800 leading-relaxed">
                                <span className="mr-2">💡</span> {details?.insight_conclusion || item.insight_summary}
                            </p>
                        </div>
                    )}
                </div>

                <div className="p-5 bg-gray-50 rounded-lg border border-gray-100">
                    <span className="block text-gray-500 text-xs font-bold mb-3 tracking-wide">今回の学習範囲</span>
                    <div className="flex flex-wrap gap-2">
                        {coveredTopics.map((topic, i) => (
                            <span key={i} className="bg-white border border-gray-200 text-gray-600 text-xs px-3 py-1.5 rounded-full font-medium shadow-sm">
                                {topic}
                            </span>
                        ))}
                    </div>
                </div>

                <div className="mb-6 p-4 bg-gray-50 rounded-xl border border-gray-100">
                    <h3 className="text-xs font-bold text-gray-600 tracking-wide mb-3">リザルト基本情報</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="bg-white border border-gray-200 rounded-lg px-3 py-2">
                            <span className="block text-[11px] text-gray-500 font-bold mb-1">生徒名</span>
                            <span className="text-sm font-semibold text-gray-800">{studentName || "生徒"}</span>
                        </div>
                        <div className="bg-white border border-gray-200 rounded-lg px-3 py-2">
                            <span className="block text-[11px] text-gray-500 font-bold mb-1">教科</span>
                            <span className="text-sm font-semibold text-gray-800">{item.subject || "未設定"}</span>
                        </div>
                        <div className="bg-white border border-gray-200 rounded-lg px-3 py-2">
                            <span className="block text-[11px] text-gray-500 font-bold mb-1">スコア</span>
                            <span className="text-sm font-semibold text-gray-800">{item.test_score ?? 0}/{item.max_score ?? 100}</span>
                        </div>
                        <div className="bg-white border border-gray-200 rounded-lg px-3 py-2">
                            <span className="block text-[11px] text-gray-500 font-bold mb-1">実施日</span>
                            <span className="text-sm font-semibold text-gray-800">{testDate}</span>
                        </div>
                    </div>
                </div>

                {weaknessAreas.length > 0 && (
                    <div className="p-4 bg-red-50 rounded-xl border border-red-100">
                        <h3 className="text-xs font-bold text-red-600 tracking-wide mb-3">重点定着分野</h3>
                        <div className="space-y-2">
                            {weaknessAreas.map((w, i) => (
                                <div key={i} className="text-sm font-semibold text-gray-700">
                                    <span className={`inline-block mr-2 text-[10px] font-bold px-2 py-1 rounded text-white ${w.level === "Primary" ? "bg-red-500" : "bg-orange-400"}`}>
                                        {w.level === "Primary" ? "最優先" : "要確認"}
                                    </span>
                                    {w.topic}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
});

HistoryResultDetail.displayName = "HistoryResultDetail";

export default HistoryResultDetail;
