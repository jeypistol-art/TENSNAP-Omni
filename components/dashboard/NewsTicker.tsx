"use client";

const NEWS_ITEMS = [
    "アップデート: 英語・数学のリザルトに復習用の見直し項目を追加しました。",
    "お知らせ: 期間成長レポートから重点テーマと復習項目をそのまま面談に使えます。",
    "障害情報: システム障害やメンテナンス時はこの欄に短文で告知します。",
];

export default function NewsTicker() {
    const items = [...NEWS_ITEMS, ...NEWS_ITEMS];

    return (
        <div className="mt-10 overflow-hidden rounded-2xl border border-slate-200 bg-slate-950 text-white shadow-lg">
            <div className="flex items-center gap-3 border-b border-white/10 px-4 py-3">
                <span className="rounded-full bg-emerald-400/15 px-2.5 py-1 text-[10px] font-bold tracking-[0.24em] text-emerald-300">
                    NEWS
                </span>
                <p className="text-xs text-slate-300">アップデートや障害情報をここで案内します</p>
            </div>
            <div className="relative py-3">
                <div className="flex min-w-max items-center gap-8 px-4 will-change-transform animate-[ticker_28s_linear_infinite]">
                    {items.map((item, index) => (
                        <span key={`${item}-${index}`} className="whitespace-nowrap text-sm font-medium text-slate-100">
                            {item}
                        </span>
                    ))}
                </div>
            </div>
            <style jsx>{`
                @keyframes ticker {
                    0% {
                        transform: translateX(0);
                    }
                    100% {
                        transform: translateX(-50%);
                    }
                }
            `}</style>
        </div>
    );
}
