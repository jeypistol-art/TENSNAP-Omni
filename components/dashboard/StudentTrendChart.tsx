"use client";

import { Line } from 'react-chartjs-2';
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
    // データを時系列（古い順）に並べ替え
    const sortedData = [...history].reverse();

    const data = {
        labels: sortedData.map(h => new Date(h.test_date || h.created_at).toLocaleDateString('ja-JP')),
        datasets: [
            {
                label: '学習理解度 (%)',
                data: sortedData.map(h => h.comprehension_score),
                borderColor: 'rgb(37, 99, 235)', // Score Snap Blue
                backgroundColor: 'rgba(37, 99, 235, 0.5)',
                tension: 0.3, // 滑らかな曲線に
            }
        ],
    };

    const options = {
        responsive: true,
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

    return (
        <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm mb-6">
            <h3 className="text-sm font-bold text-gray-500 mb-4 uppercase tracking-wider">成長トレンド</h3>
            <Line data={data} options={options} />
        </div>
    );
}
