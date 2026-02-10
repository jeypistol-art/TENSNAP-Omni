"use client";

import React, { forwardRef } from 'react';

type AnalysisReportProps = {
    data: {
        studentName: string;
        testDate: string;
        subject: string;
        unitName: string;
        score: number;
        maxScore: number;
        comprehension: number;
        summary: string;
        weaknesses: { topic: string; level: string }[];
    };
};

const AnalysisReport = forwardRef<HTMLDivElement, AnalysisReportProps>(({ data }, ref) => {
    return (
        // Print Container: Hidden on screen, visible on print
        // But for development we might want to see it or keep it hidden.
        // react-to-print finds it by ref.
        <div ref={ref} className="w-[210mm] min-h-[297mm] p-[20mm] bg-white text-gray-800 font-sans mx-auto">
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
                    <p className="text-sm font-bold text-gray-600 tracking-wide mt-1 ml-1">学習理解度・成長分析報告書</p>
                </div>
                <div className="text-right">
                    <p className="text-sm text-gray-600">実施日: {data.testDate}</p>
                </div>
            </header>

            {/* Student Info */}
            <section className="bg-gray-50 rounded-lg p-6 mb-8 border border-gray-100">
                <div className="flex justify-between items-center">
                    <h2 className="text-xl font-bold text-gray-800">{data.studentName} <span className="text-sm font-normal text-gray-500 ml-1">様</span></h2>
                    <div className="text-right">
                        <span className="inline-block bg-blue-100 text-blue-800 text-xs font-bold px-3 py-1 rounded-full mr-2">{data.subject}</span>
                        <span className="text-sm font-medium text-gray-700">{data.unitName}</span>
                    </div>
                </div>
            </section>

            {/* Score Overview */}
            <section className="grid grid-cols-2 gap-6 mb-10">
                <div className="border border-gray-200 rounded-xl p-6 text-center">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">得点</p>
                    <div className="text-4xl font-extrabold text-gray-900">
                        {data.score} <span className="text-lg text-gray-400 font-medium">/ {data.maxScore}</span>
                    </div>
                </div>
                <div className="border border-gray-200 rounded-xl p-6 text-center relative overflow-hidden">
                    <div className={`absolute top-0 left-0 w-2 h-full ${data.comprehension >= 80 ? 'bg-green-500' : data.comprehension >= 50 ? 'bg-blue-500' : 'bg-red-500'}`}></div>
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">学習理解度</p>
                    <div className={`text-4xl font-extrabold ${data.comprehension >= 80 ? 'text-green-600' : data.comprehension >= 50 ? 'text-blue-600' : 'text-red-500'}`}>
                        {data.comprehension}<span className="text-lg">%</span>
                    </div>
                </div>
            </section>

            {/* AI Insights */}
            <section className="mb-10">
                <h3 className="text-lg font-bold text-blue-800 mb-4 flex items-center gap-2">
                    <span className="text-xl">💡</span> AI分析・学習アドバイス
                </h3>
                <div className="bg-white border-l-4 border-blue-500 pl-4 py-2">
                    <p className="text-sm leading-relaxed text-gray-700 whitespace-pre-wrap">
                        {data.summary}
                    </p>
                </div>
            </section>

            {/* Weakness Areas */}
            {data.weaknesses.length > 0 && (
                <section className="mb-10">
                    <h3 className="text-lg font-bold text-red-700 mb-4 flex items-center gap-2">
                        <span className="text-xl">🔥</span> 重点復習ポイント
                    </h3>
                    <div className="space-y-3">
                        {data.weaknesses.map((w, i) => (
                            <div key={i} className="flex items-center gap-3 p-3 bg-red-50 rounded-lg border border-red-100">
                                <span className={`
                                    text-[10px] font-bold px-2 py-1 rounded text-white min-w-[60px] text-center
                                    ${w.level === 'Primary' ? 'bg-red-600' : 'bg-orange-500'}
                                `}>
                                    {w.level === 'Primary' ? '最優先' : '要確認'}
                                </span>
                                <span className="text-sm font-bold text-gray-800">{w.topic}</span>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {/* Footer */}
            <footer className="mt-auto pt-8 border-t border-gray-100 text-center">
                <p className="text-[10px] text-gray-400">Generated by TENsNAP・Omni</p>
            </footer>
        </div>
    );
});

AnalysisReport.displayName = "AnalysisReport";
export default AnalysisReport;
