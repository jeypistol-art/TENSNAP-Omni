"use client";

import { useState, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import PeriodicalReport from "./PeriodicalReport"; // [NEW] Import
import ReportPreviewModal from "./ReportPreviewModal"; // [NEW] Import
import HistoryResultDetail from "./HistoryResultDetail";
import type { AnalysisDetails } from "./HistoryResultDetail";
import { useReactToPrint } from "react-to-print";
import {
    DEFAULT_SUBJECT,
    SUBJECT_OPTIONS,
    detectSubjectCategory,
    isSubjectMatch,
    normalizeSubjectLabel,
} from "@/lib/subjects";

const StudentTrendChart = dynamic(() => import("./StudentTrendChart"), {
    ssr: false,
    loading: () => <div className="text-xs text-gray-400 mb-4">トレンドを読み込み中...</div>,
});

/* Removed PDFDownloadLink prototype */

type HistoryItem = {
    id: string;
    test_date: string;
    subject: string;
    unit_name: string;
    test_score: number;
    max_score: number;
    comprehension_score: number;
    insight_summary: string;
    weaknesses: { topic: string; level: string }[];
    created_at: string;
    details?: AnalysisDetails;
};

type PeriodicalData = {
    studentName: string;
    targetSchool?: string;
    periodStr: string;
    subjectLabel: string;
    startStats: { accuracy: number; process: number; consistency: number };
    currentStats: { accuracy: number; process: number; consistency: number };
    weaknesses: { topic: string; count: number; units?: string[] }[];
    aiSummary: string;
};

type StudentHistoryProps = {
    studentId: string;
    studentName: string;
    targetSchool?: string;
};

export default function StudentHistory({ studentId, studentName, targetSchool }: StudentHistoryProps) {
    const [history, setHistory] = useState<HistoryItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [editingHistoryId, setEditingHistoryId] = useState<string | null>(null);
    const [historyDraft, setHistoryDraft] = useState<{ subject: string; test_date: string; comprehension_score: string }>({
        subject: DEFAULT_SUBJECT,
        test_date: "",
        comprehension_score: "0"
    });
    const [historySaving, setHistorySaving] = useState(false);
    const [historyError, setHistoryError] = useState("");

    // Date Range State
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    // Subject Filter State
    const [subjectFilter, setSubjectFilter] = useState("all");

    // Printing Logic (Single)
    const printRef = useRef<HTMLDivElement>(null);
    const [selectedHistoryItem, setSelectedHistoryItem] = useState<HistoryItem | null>(null);
    const handlePrintSingle = useReactToPrint({ contentRef: printRef });

    // Printing Logic (Periodical)
    const periodicalPrintRef = useRef<HTMLDivElement>(null);
    const [periodicalData, setPeriodicalData] = useState<PeriodicalData | null>(null);
    const [isGeneratingReport, setIsGeneratingReport] = useState(false);
    const handlePrintPeriodical = useReactToPrint({ contentRef: periodicalPrintRef });

    // Preview Modal State
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);
    const [previewType, setPreviewType] = useState<"single" | "periodical">("single");
    const [previewMode, setPreviewMode] = useState<"view" | "action">("view");
    const subjectOptions = SUBJECT_OPTIONS;

    const formatDateForInput = (value?: string) => {
        if (!value) return "";
        const direct = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (direct) return `${direct[1]}-${direct[2]}-${direct[3]}`;

        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return "";

        const yyyy = date.getFullYear();
        const mm = String(date.getMonth() + 1).padStart(2, "0");
        const dd = String(date.getDate()).padStart(2, "0");
        return `${yyyy}-${mm}-${dd}`;
    };

    const formatDateForDisplay = (value?: string) => {
        if (!value) return "日付不明";
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return "日付不明";
        return date.toLocaleDateString();
    };

    const openPreviewSingle = (item: HistoryItem, mode: "view" | "action") => {
        setSelectedHistoryItem(item);
        setPreviewType("single");
        setPreviewMode(mode);
        setIsPreviewOpen(true);
    };

    const triggerPrint = (item: HistoryItem) => {
        // Open in Action mode (Print/Save)
        openPreviewSingle(item, "action");
    };

    const subjectBadgeClass = (subject: string) => {
        switch (detectSubjectCategory(subject)) {
            case "math":
                return "bg-blue-500";
            case "english":
                return "bg-orange-500";
            case "japanese":
                return "bg-emerald-500";
            case "science":
                return "bg-teal-500";
            case "social":
                return "bg-purple-500";
            default:
                return "bg-gray-500";
        }
    };

    const startHistoryEdit = (item: HistoryItem) => {
        const dateVal = formatDateForInput(item.test_date || item.created_at);
        setHistoryError("");
        setEditingHistoryId(item.id);
        setHistoryDraft({
            subject: normalizeSubjectLabel(item.subject) || DEFAULT_SUBJECT,
            test_date: dateVal,
            comprehension_score: String(item.comprehension_score ?? 0)
        });
    };

    const commitHistoryEdit = async () => {
        if (!editingHistoryId || historySaving) return;
        setHistorySaving(true);
        setHistoryError("");
        try {
            const res = await fetch(`/api/analysis/${editingHistoryId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    subject: normalizeSubjectLabel(historyDraft.subject),
                    testDate: historyDraft.test_date,
                    comprehensionScore: Number(historyDraft.comprehension_score)
                })
            });
            if (!res.ok) throw new Error("Failed to update history");

            setHistory(prev => prev.map(item => {
                if (item.id !== editingHistoryId) return item;
                return {
                    ...item,
                    subject: normalizeSubjectLabel(historyDraft.subject),
                    test_date: historyDraft.test_date,
                    comprehension_score: Number(historyDraft.comprehension_score)
                };
            }));
        } catch (e) {
            console.error(e);
            setHistoryError("保存に失敗しました");
        } finally {
            setHistorySaving(false);
            setEditingHistoryId(null);
        }
    };

    const generatePeriodicalReport = async () => {
        if (!startDate || !endDate) return;
        setIsGeneratingReport(true);
        try {
            const qs = new URLSearchParams({
                studentId,
                startDate,
                endDate,
            });
            if (subjectFilter && subjectFilter !== "all") {
                qs.set("subject", subjectFilter);
            }
            const res = await fetch(`/api/history/aggregate?${qs.toString()}`);
            if (!res.ok) {
                let message = "集計データの取得に失敗しました";
                try {
                    const body = await res.json();
                    message = body?.error || message;
                } catch { }
                throw new Error(message);
            }

            const data = await res.json();
            if (!data.aggregated) {
                alert("指定期間のデータがありません");
                return;
            }

            setPeriodicalData({
                studentName: studentName || "生徒",
                targetSchool: targetSchool || "",
                periodStr: `${new Date(startDate).toLocaleDateString()} 〜 ${new Date(endDate).toLocaleDateString()}`,
                subjectLabel: subjectFilter === "all" ? "全教科" : normalizeSubjectLabel(subjectFilter),
                ...data.aggregated
            });

            // Open Preview for Periodical Report instead of direct print
            setPreviewType("periodical");
            setPreviewMode("action"); // Always actionable for the big report
            setIsPreviewOpen(true);

            // Legacy direct print logic removed/commented
            /*setTimeout(() => {
                handlePrintPeriodical();
            }, 500); */

        } catch (e) {
            console.error(e);
            alert("レポート生成中にエラーが発生しました");
        } finally {
            setIsGeneratingReport(false);
        }
    };

    // Filter History Display
    const filteredHistory = history.filter(item => {
        const itemDate = formatDateForInput(item.test_date || item.created_at);
        if (!itemDate) return false;
        if (startDate && itemDate < startDate) return false;
        if (endDate && itemDate > endDate) return false;
        if (subjectFilter !== "all" && !isSubjectMatch(item.subject, subjectFilter)) return false;
        return true;
    });

    useEffect(() => {
        if (!studentId) return;

        const fetchHistory = async () => {
            setLoading(true);
            setError("");
            try {
                const res = await fetch(`/api/history?studentId=${studentId}`);
                if (!res.ok) {
                    let message = "履歴の取得に失敗しました";
                    try {
                        const body = await res.json();
                        message = body?.error || message;
                    } catch { }
                    throw new Error(message);
                }
                const data = await res.json();
                setHistory((data.history || []).map((item: HistoryItem) => ({
                    ...item,
                    subject: normalizeSubjectLabel(item.subject),
                })));
            } catch (err) {
                console.error(err);
                setError(err instanceof Error ? err.message : "履歴データを読み込めませんでした");
            } finally {
                setLoading(false);
            }
        };

        fetchHistory();
    }, [studentId]);

    const handleDelete = async (id: string) => {
        if (!confirm("この分析結果を削除しますか？\n（この操作は取り消せません）")) return;

        try {
            const res = await fetch(`/api/history?id=${id}`, { method: "DELETE" });
            if (!res.ok) throw new Error("削除に失敗しました");

            // Remove from local state
            setHistory(prev => prev.filter(item => item.id !== id));
        } catch (err) {
            console.error(err);
            alert("削除できませんでした");
        }
    };

    if (loading) return <div className="p-4 text-center text-gray-500 text-sm animate-pulse">履歴を読み込み中...</div>;
    if (error) return <div className="p-4 text-center text-red-500 text-sm">{error}</div>;
    if (history.length === 0) return <div className="p-4 text-center text-gray-400 text-sm">分析履歴はまだありません</div>;

    return (
        <div className="bg-gray-50 border-t border-gray-200 max-h-[600px] overflow-y-auto p-4 custom-scrollbar">

            {/* [NEW] Date Range Filter & Victory Report Button */}
            <div className="mb-6 bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between sticky top-0 z-10 backdrop-blur-sm bg-white/90">
                <div className="flex items-center gap-2 w-full md:w-auto">
                    <div className="flex bg-gray-100 rounded-lg p-1">
                        <input
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="bg-transparent text-xs font-bold text-gray-600 px-2 py-1 outline-none"
                        />
                        <span className="text-gray-400 px-1 self-center">~</span>
                        <input
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            className="bg-transparent text-xs font-bold text-gray-600 px-2 py-1 outline-none"
                        />
                    </div>
                    {/* Subject Filter */}
                    <div className="flex bg-gray-100 rounded-lg p-1">
                        <select
                            value={subjectFilter}
                            onChange={(e) => setSubjectFilter(e.target.value)}
                            className="bg-transparent text-xs font-bold text-gray-600 px-2 py-1 outline-none cursor-pointer"
                        >
                            <option value="all">全教科</option>
                            {subjectOptions.map((s) => (
                                <option key={s} value={s}>{s}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {startDate && endDate && (
                    <button
                        onClick={generatePeriodicalReport}
                        disabled={isGeneratingReport}
                        className={`
                            flex items-center gap-2 px-4 py-2 rounded-full font-bold text-sm shadow-md transition-all
                            ${isGeneratingReport
                                ? 'bg-gray-100 text-gray-400 cursor-wait'
                                : 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:shadow-lg hover:scale-105 active:scale-95'}
                        `}
                    >
                        {isGeneratingReport ? (
                            <span>生成中...</span>
                        ) : (
                            <>
                                <span>📊</span>
                                <span>期間成長レポート（面談用）を出力</span>
                            </>
                        )}
                    </button>
                )}
            </div>

            {/* Trend Graph - Use Filtered Data? Optionally. For now keep showing full history or filtered? Let's show filtered if range exists */}
            {filteredHistory.length > 1 && <StudentTrendChart history={filteredHistory.length > 0 ? filteredHistory : history} />}

            <div className="space-y-3">
                {filteredHistory.map((item) => (
                    <div key={item.id} className="bg-white p-4 rounded-lg shadow-sm border border-gray-100 hover:shadow-md transition-shadow relative group">

                        {/* Delete Button */}
                        <button
                            onClick={(e) => { e.stopPropagation(); handleDelete(item.id); }}
                            className="absolute top-3 right-3 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all p-1"
                            title="この履歴を削除"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>

                        <div className="flex justify-between items-start mb-2 pr-8">
                            <div className="flex items-center gap-2">
                                <span className={`
                                    px-2 py-0.5 rounded text-[10px] font-bold text-white
                                    ${subjectBadgeClass(item.subject)}
                                `}>
                                    {normalizeSubjectLabel(item.subject) || "教科未設定"}
                                </span>
                                <span className="text-gray-500 text-xs font-mono">
                                    {formatDateForDisplay(item.test_date || item.created_at)}
                                </span>
                            </div>
                            <div className="flex items-center gap-1">
                                <span className="text-xs text-gray-400 font-bold">理解度</span>
                                <span className={`text-lg font-extrabold ${item.comprehension_score >= 80 ? 'text-green-600' :
                                    item.comprehension_score >= 50 ? 'text-blue-600' : 'text-red-500'
                                    }`}>
                                    {item.comprehension_score}%
                                </span>
                            </div>
                        </div>

                        {editingHistoryId === item.id && (
                            <div className="mb-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
                                <div>
                                    <label className="block text-[11px] text-gray-500 font-bold mb-1">教科</label>
                                    <select
                                        value={historyDraft.subject}
                                        onChange={(e) => setHistoryDraft({ ...historyDraft, subject: e.target.value })}
                                        onBlur={commitHistoryEdit}
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter") {
                                                e.preventDefault();
                                                commitHistoryEdit();
                                            }
                                        }}
                                        className={`w-full text-xs text-white font-bold px-2 py-1 rounded border border-blue-300 outline-none ${subjectBadgeClass(historyDraft.subject)}`}
                                    >
                                        {subjectOptions.map(s => (
                                            <option key={s} value={s} className="text-gray-800">
                                                {s}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-[11px] text-gray-500 font-bold mb-1">日付</label>
                                    <input
                                        type="date"
                                        value={historyDraft.test_date}
                                        onChange={(e) => setHistoryDraft({ ...historyDraft, test_date: e.target.value })}
                                        onBlur={commitHistoryEdit}
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter") {
                                                e.preventDefault();
                                                commitHistoryEdit();
                                            }
                                        }}
                                        className="w-full text-xs border border-blue-300 bg-blue-50 rounded-md px-2 py-1 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[11px] text-gray-500 font-bold mb-1">理解度</label>
                                    <input
                                        type="number"
                                        value={historyDraft.comprehension_score}
                                        onChange={(e) => setHistoryDraft({ ...historyDraft, comprehension_score: e.target.value })}
                                        onBlur={commitHistoryEdit}
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter") {
                                                e.preventDefault();
                                                commitHistoryEdit();
                                            }
                                        }}
                                        className="w-full text-xs border border-blue-300 bg-blue-50 rounded-md px-2 py-1 outline-none"
                                    />
                                </div>
                                {historyError && (
                                    <div className="sm:col-span-3 text-xs text-red-500">{historyError}</div>
                                )}
                            </div>
                        )}

                        <h4 className="font-bold text-gray-800 text-sm mb-1 line-clamp-1">
                            {item.unit_name || "単元名なし"}
                        </h4>

                        <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed">
                            💡 {item.insight_summary || "詳細な分析結果がここに表示されます。"}
                        </p>

                        {/* Quick Actions */}
                        <div className="absolute bottom-3 right-3 flex gap-2">
                            {/* Preview Button */}
                            <button
                                onClick={(e) => { e.stopPropagation(); openPreviewSingle(item, "view"); }}
                                className="text-gray-400 hover:text-blue-600 transition-colors p-1"
                                title="プレビュー"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                            </button>
                            {/* Edit Button */}
                            <button
                                onClick={(e) => { e.stopPropagation(); startHistoryEdit(item); }}
                                className="text-gray-400 hover:text-gray-600 transition-colors p-1"
                                title="編集"
                                disabled={historySaving}
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                            </button>
                            {/* Save/Print Button */}
                            <button
                                onClick={(e) => { e.stopPropagation(); triggerPrint(item); }}
                                className="text-gray-400 hover:text-indigo-600 transition-colors p-1"
                                title="印刷 / PDF保存"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {/* Hidden Print Component */}
            <div style={{ position: "absolute", top: "-10000px", left: "-10000px", width: "210mm" }}>
                {/* Single Report (Hidden instance for print API if needed separately, but we use Modal ref now) */}
                {/* Actually, react-to-print needs a ref to a mounted component. 
                    The Modal mounts the component, so we can print from there?
                    Yes, if the modal is open. But we need separate refs for the modal content?
                    Let's bind the handlePrint to the Modal's content.
                */}
            </div>

            {/* Preview Modal */}
            <ReportPreviewModal
                isOpen={isPreviewOpen}
                onClose={() => setIsPreviewOpen(false)}
                onPrint={previewType === "single" ? handlePrintSingle : handlePrintPeriodical}
                title={previewType === "single" ? "分析レポート (プレビュー)" : "期間成長レポート (プレビュー)"}
                showActions={previewMode === "action"}
            >
                {/* 
                    We need to render the report here for PREVIEW.
                    And ALSO attach the Ref to it so react-to-print can grab it. 
                */}
                <div className="bg-white shadow-lg origin-top">
                    {previewType === "single" && selectedHistoryItem && <HistoryResultDetail ref={printRef} item={selectedHistoryItem} studentName={studentName || "生徒"} />}
                    {previewType === "periodical" && periodicalData && <PeriodicalReport ref={periodicalPrintRef} data={periodicalData} />}
                </div>
            </ReportPreviewModal>
        </div>
    );
}
