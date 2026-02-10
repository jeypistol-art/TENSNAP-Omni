"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Device = {
    id: string;
    name: string | null;
    last_active_at: string | null;
    created_at: string | null;
};

export default function SettingsPage() {
    const [devices, setDevices] = useState<Device[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const fetchDevices = async () => {
        setLoading(true);
        setError("");
        try {
            const res = await fetch("/api/org/device/list");
            if (!res.ok) throw new Error("Failed to load");
            const data = await res.json();
            setDevices(data.devices || []);
        } catch (e) {
            console.error(e);
            setError("デバイス情報を取得できませんでした");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDevices();
    }, []);

    const handleDelete = async (deviceId: string) => {
        if (!confirm("この端末を削除しますか？")) return;
        try {
            const res = await fetch(`/api/org/device/list?id=${deviceId}`, { method: "DELETE" });
            if (!res.ok) throw new Error("Failed to delete");
            setDevices(prev => prev.filter(d => d.id !== deviceId));
        } catch (e) {
            console.error(e);
            alert("削除に失敗しました");
        }
    };

    return (
        <div className="max-w-3xl mx-auto px-4 py-8">
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-xl font-bold text-gray-800">設定</h1>
                <Link href="/" className="text-sm text-gray-500 hover:text-blue-600">← ダッシュボードに戻る</Link>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
                <h2 className="text-sm font-bold text-gray-600 mb-3">登録済みデバイス</h2>
                {loading && <p className="text-sm text-gray-400">読み込み中...</p>}
                {error && <p className="text-sm text-red-500">{error}</p>}
                {!loading && !error && devices.length === 0 && (
                    <p className="text-sm text-gray-400">登録済みデバイスはありません</p>
                )}
                <div className="space-y-2">
                    {devices.map(d => (
                        <div key={d.id} className="flex items-center justify-between gap-3 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                            <div className="min-w-0">
                                <p className="text-xs font-semibold text-gray-700 truncate">{d.name || "Unknown Device"}</p>
                                <p className="text-[10px] text-gray-400">
                                    最終アクティブ: {d.last_active_at ? new Date(d.last_active_at).toLocaleString() : "不明"}
                                </p>
                            </div>
                            <button
                                onClick={() => handleDelete(d.id)}
                                className="text-gray-400 hover:text-red-500 transition-colors p-1"
                                title="削除"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            </button>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
