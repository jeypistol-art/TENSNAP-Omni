"use client";

import { useEffect, useRef } from 'react';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

export default function StudentTrendChart({ history }: { history: any[] }) {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const chartRef = useRef<ChartJS<"line"> | null>(null);

    // データを時系列（古い順）に並べ替え
    const safeHistory = Array.isArray(history)
        ? history.filter((h) => h && typeof h === "object")
        : [];
    const sortedData = [...safeHistory].reverse();

    const data = {
        labels: sortedData.map(h => {
            const raw = h.test_date || h.created_at;
            const d = new Date(raw);
            return Number.isNaN(d.getTime()) ? "日付不明" : d.toLocaleDateString("ja-JP");
        }),
        datasets: [
            {
                label: '学習理解度 (%)',
                data: sortedData.map(h => {
                    const n = Number(h.comprehension_score);
                    return Number.isFinite(n) ? n : 0;
                }),
                borderColor: 'rgb(37, 99, 235)', // Score Snap Blue
                backgroundColor: 'rgba(37, 99, 235, 0.5)',
                tension: 0.3, // 滑らかな曲線に
            }
        ],
    };

    const options = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: false },
            tooltip: {
                callbacks: {
                    afterLabel: (context: any) => {
                        const item = sortedData[context.dataIndex];
                        return `単元: ${item.unit_name || '(不明)'} | インサイト: ${item.insight_summary || 'なし'}`;
                    }
                }
            }
        },
        scales: {
            y: { min: 0, max: 100 }
        }
    };

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        if (chartRef.current) {
            chartRef.current.destroy();
        }

        try {
            chartRef.current = new ChartJS(canvas, {
                type: "line",
                data,
                options,
            });
        } catch (error) {
            console.error("StudentTrendChart render error:", error);
        }

        return () => {
            if (chartRef.current) {
                chartRef.current.destroy();
                chartRef.current = null;
            }
        };
    }, [history]);

    return (
        <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm mb-6">
            <h3 className="text-sm font-bold text-gray-500 mb-4 uppercase tracking-wider">成長トレンド</h3>
            <div className="h-64">
                <canvas ref={canvasRef} />
            </div>
        </div>
    );
}
