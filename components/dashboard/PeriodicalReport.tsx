"use client";
/* eslint-disable @next/next/no-img-element */

import React, { forwardRef, useEffect, useMemo, useRef } from 'react';
import Chart from 'chart.js/auto';
import type { Chart as ChartJS } from 'chart.js';
import { normalizeSubjectLabel } from "@/lib/subjects";

type PeriodicalReportProps = {
    data: {
        studentName: string;
        targetSchool?: string;
        periodStr: string;
        subjectLabel: string;
        startStats: { accuracy: number; process: number; consistency: number };
        currentStats: { accuracy: number; process: number; consistency: number };
        weaknesses: { topic: string; count: number; units?: string[] }[];
        aiSummary: string;
    };
};

const PeriodicalReport = forwardRef<HTMLDivElement, PeriodicalReportProps>(({ data }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const chartRef = useRef<ChartJS<"radar"> | null>(null);

    const chartData = useMemo(() => ({
        labels: ['得点理解度', '思考プロセス', '学習の安定感'],
        datasets: [
            {
                label: '期間開始時',
                data: [data.startStats.accuracy, data.startStats.process, data.startStats.consistency],
                backgroundColor: 'rgba(249, 115, 22, 0.2)', // Orange-500 equivalent
                borderColor: 'rgba(249, 115, 22, 1)',
                borderWidth: 2,
            },
            {
                label: '現在 (到達点)',
                data: [data.currentStats.accuracy, data.currentStats.process, data.currentStats.consistency],
                backgroundColor: 'rgba(37, 99, 235, 0.4)', // Blue
                borderColor: 'rgb(37, 99, 235)',
                borderWidth: 2,
            },
        ],
    }), [data.currentStats.accuracy, data.currentStats.consistency, data.currentStats.process, data.startStats.accuracy, data.startStats.consistency, data.startStats.process]);

    const chartOptions = useMemo(() => ({
        responsive: true,
        maintainAspectRatio: false,
        scales: {
            r: {
                angleLines: {
                    display: true
                },
                suggestedMin: 0,
                suggestedMax: 100
            }
        },
        plugins: {
            legend: {
                position: 'bottom' as const,
            }
        }
    }), []);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const existing = Chart.getChart(canvas);
        if (existing) {
            existing.destroy();
        }

        if (chartRef.current) {
            chartRef.current.destroy();
        }

        chartRef.current = new Chart(canvas, {
            type: "radar",
            data: chartData,
            options: chartOptions,
        });

        return () => {
            if (chartRef.current) {
                chartRef.current.destroy();
                chartRef.current = null;
            }
        };
    }, [chartData, chartOptions, data]);

    return (
        <div ref={ref} className="w-full max-w-[210mm] print:w-[210mm] min-h-[297mm] p-4 sm:p-[20mm] print:p-[20mm] bg-white text-gray-800 font-sans mx-auto">
            {/* Header */}
            <header className="flex justify-between items-end border-b-2 border-gray-200 pb-4 mb-8">
                <div>
                    <div className="w-48 mb-2">
                        <img
                            src="/images/logo.png"
                            alt="TENsNAP・Omni"
                            className="w-full h-auto object-contain"
                        />
                    </div>
                    <p className="text-sm font-bold text-gray-600 tracking-wide mt-1 ml-1">期間成長・必勝レポート</p>
                </div>
                <div className="text-right">
                    <p className="text-sm text-gray-600 font-medium">対象期間</p>
                    <p className="text-md font-bold text-blue-900">{data.periodStr}</p>
                    <p className="text-xs text-gray-600 font-semibold mt-1">対象教科: {normalizeSubjectLabel(data.subjectLabel)}</p>
                </div>
            </header>

            {/* Student Info */}
            <section className="bg-gradient-to-r from-blue-50 to-white rounded-lg p-6 mb-8 border-l-4 border-blue-600 shadow-sm">
                <h2 className="text-2xl font-bold text-gray-800">{data.studentName} <span className="text-base font-normal text-gray-500 ml-1">様</span></h2>
                {data.targetSchool && (
                    <p className="text-sm text-gray-700 font-semibold mt-2">志望校：{data.targetSchool}</p>
                )}
                <p className="text-sm text-blue-600 font-bold mt-2">✨ 特別成長分析レポート</p>
            </section>

            {/* Growth Radar Chart */}
            <section className="mb-10 flex flex-col sm:flex-row gap-4 sm:gap-8">
                <div className="flex-1">
                    <h3 className="text-lg font-bold text-blue-800 mb-4 flex items-center gap-2">
                        <span className="text-xl">📈</span> 成長の軌跡 (Growth Triangle)
                    </h3>
                    <div className="h-64 flex justify-center">
                        <canvas ref={canvasRef} />
                    </div>
                </div>
                <div className="flex-1 flex flex-col justify-center gap-4">
                    <div className="bg-green-50 p-4 rounded-lg border border-green-100">
                        <p className="text-xs font-bold text-green-600 uppercase mb-1">得点理解度の変化</p>
                        <div className="flex items-end gap-2">
                            <span className="text-lg text-gray-400 font-medium">{data.startStats.accuracy}%</span>
                            <span className="text-gray-400">→</span>
                            <span className="text-3xl font-extrabold text-green-600">{data.currentStats.accuracy}%</span>
                        </div>
                    </div>
                    <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                        <p className="text-xs font-bold text-blue-600 uppercase mb-1">思考プロセスの深化</p>
                        <div className="flex items-end gap-2">
                            <span className="text-lg text-gray-400 font-medium">{data.startStats.process}%</span>
                            <span className="text-gray-400">→</span>
                            <span className="text-3xl font-extrabold text-blue-600">{data.currentStats.process}%</span>
                        </div>
                    </div>
                </div>
            </section>

            <section className="mb-10">
                <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                    <span className="text-xl">🎓</span> 総評 & 次の一手
                </h3>
                <div className="bg-white p-6 rounded-xl border-2 border-indigo-100 shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-2 h-full bg-indigo-500"></div>
                    <p className="text-lg leading-relaxed text-gray-800 font-medium whitespace-pre-wrap font-serif">
                        {data.aiSummary || "分析データが不足しています。"}
                    </p>
                </div>
            </section>

            {/* Weakness Ranking */}
            {data.weaknesses.length > 0 && (
                <section className="mb-10">
                    <h3 className="text-lg font-bold text-red-700 mb-4 flex items-center gap-2">
                        <span className="text-xl">🔥</span> 期間内の重点克服テーマ
                    </h3>
                    <div className="grid grid-cols-1 gap-3">
                        {data.weaknesses.map((w, i) => (
                            <div key={i} className="bg-red-50 rounded-lg border border-red-100 p-3">
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-3">
                                        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-red-200 text-red-800 text-xs font-bold">
                                            {i + 1}
                                        </span>
                                        <span className="text-sm font-bold text-gray-800">{w.topic}</span>
                                    </div>
                                    <span className="text-xs font-bold text-red-400">{w.count}回 出現</span>
                                </div>
                                {/* [NEW] Unit Tags */}
                                {w.units && w.units.length > 0 && (
                                    <div className="flex flex-wrap gap-1 ml-9">
                                        {w.units.map((unit, idx) => (
                                            <span key={idx} className="bg-white text-black font-bold text-xs px-2 py-0.5 rounded border border-gray-300 shadow-sm">
                                                {unit}
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </section>
            )}

            <footer className="mt-auto pt-8 border-t border-gray-100 text-center">
                <p className="text-[10px] text-gray-400">Generated by TENsNAP・Omni Periodical Engine</p>
            </footer>
        </div>
    );
});

PeriodicalReport.displayName = "PeriodicalReport";
export default PeriodicalReport;
