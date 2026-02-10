import { ComponentType } from "react";

// Fallback spinner if lucide-react isn't available or for simple SVG usage
const Spinner = () => (
    <svg className="animate-spin h-10 w-10 text-blue-600 mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
);

export default function AnalysisStatus({ status }: { status: string }) {
    const isUploading = status === "uploading";

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="w-full max-w-md p-8 bg-white rounded-2xl shadow-2xl flex flex-col items-center justify-center text-center animate-in zoom-in-95 duration-300 border border-blue-50 relative overflow-hidden">
                {/* Decorative background pulse */}
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-400 via-purple-500 to-blue-400 animate-gradient-x"></div>

                <div className="relative mb-8 mt-2">
                    <Spinner />
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-3 h-3 bg-blue-500 rounded-full animate-ping"></div>
                    </div>
                </div>

                <h3 className="text-2xl font-bold text-gray-800 mb-3 tracking-wide">
                    {isUploading ? "画像をアップロード中..." : "AIによる精密分析を実行中"}
                </h3>

                <p className="text-gray-500 text-sm font-medium mb-8">
                    {isUploading
                        ? "画像を最適化して送信しています"
                        : "文字認識・採点・理解度判定を並列処理しています..."}
                </p>

                <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden shadow-inner">
                    <div
                        className="bg-gradient-to-r from-blue-500 to-indigo-600 h-3 rounded-full animate-progress-indeterminate shadow-lg"
                        style={{ width: "30%", marginLeft: isUploading ? "0%" : "30%" }}
                    ></div>
                </div>

                <p className="text-xs text-gray-400 mt-4 animate-pulse">
                    ※ 画面を閉じずにお待ちください
                </p>
            </div>
        </div>
    );
}
