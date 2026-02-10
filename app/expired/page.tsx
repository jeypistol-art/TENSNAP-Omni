"use client";

export default function ExpiredPage() {
    const handleSubscribe = async () => {
        try {
            const res = await fetch("/api/stripe/checkout", { method: "POST" });
            const data = await res.json();
            if (data.url) {
                window.location.href = data.url;
            } else {
                alert("決済システムの接続に失敗しました。");
            }
        } catch (e) {
            alert("エラーが発生しました。");
        }
    };

    return (
        <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center p-4">
            <div className="max-w-md w-full bg-white rounded-2xl shadow-2xl overflow-hidden text-center p-8 animate-in fade-in zoom-in-95 duration-500">
                <div className="w-20 h-20 bg-yellow-100 text-yellow-600 rounded-full flex items-center justify-center mx-auto mb-6">
                    <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </div>

                <h1 className="text-2xl font-bold text-gray-800 mb-2">トライアル期間が終了しました</h1>
                <p className="text-gray-500 mb-8 leading-relaxed">
                    無料トライアルをご利用いただきありがとうございます。<br />
                    引き続きすべての機能をご利用いただくには、<br />
                    本契約のお手続きをお願いいたします。
                </p>

                <div className="space-y-4">
                    <button
                        onClick={handleSubscribe}
                        className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold py-4 rounded-xl shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all"
                    >
                        プランを選択して再開する
                    </button>

                    <p className="text-xs text-gray-400">
                        ※ データは14日間保持されますが、その後削除される可能性があります。
                    </p>
                </div>
            </div>
        </div>
    );
}
