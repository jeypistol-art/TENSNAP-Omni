"use client";

import { useState } from "react";

type Props = {
    isOpen: boolean;
    onClose: () => void;
    onAdded: (newStudent: any) => void;
};

export default function AddStudentModal({ isOpen, onClose, onAdded }: Props) {
    const [formData, setFormData] = useState({
        name: "",
        grade: "",
        target_school: "",
        notes: ""
    });
    const [isSubmitting, setIsSubmitting] = useState(false);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isSubmitting) return;
        setIsSubmitting(true);

        try {
            const res = await fetch("/api/students", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(formData),
            });

            if (res.ok) {
                const data = await res.json();
                // API returns { student: ... } wrapper in my route implementation
                onAdded(data.student);
                onClose();
                // Reset form
                setFormData({ name: "", grade: "", target_school: "", notes: "" });
            } else {
                alert("Failed to create student");
            }
        } catch (e) {
            console.error(e);
            alert("Error creating student");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-in fade-in duration-200">
            <div className="bg-white p-8 rounded-2xl w-full max-w-md shadow-2xl scale-100 animate-in zoom-in-95 duration-200">
                <h2 className="text-2xl font-bold mb-6 text-gray-800">新規生徒登録</h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-semibold mb-1 text-gray-700">氏名 <span className="text-red-500">*</span></label>
                        <input
                            required
                            className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                            placeholder="山田 太郎"
                            value={formData.name}
                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                            autoFocus
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-semibold mb-1 text-gray-700">ふりがな (検索用)</label>
                        <input
                            className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                            placeholder="やまだ たろう"
                            value={(formData as any).name_kana || ""}
                            onChange={e => setFormData({ ...formData, name_kana: e.target.value } as any)}
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-semibold mb-1 text-gray-700">学年</label>
                            <input
                                className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                placeholder="例: 中2"
                                value={formData.grade}
                                onChange={e => setFormData({ ...formData, grade: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold mb-1 text-gray-700">志望校</label>
                            <input
                                className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                placeholder="例: ○○高校"
                                value={formData.target_school}
                                onChange={e => setFormData({ ...formData, target_school: e.target.value })}
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-semibold mb-1 text-gray-700">備考 (AIへのヒント)</label>
                        <textarea
                            className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none min-h-[80px]"
                            placeholder="例: 数学が苦手。ケアレスミス多め。"
                            value={formData.notes}
                            onChange={e => setFormData({ ...formData, notes: e.target.value })}
                        />
                    </div>
                    <div className="flex gap-4 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 py-3 bg-gray-100 rounded-lg font-bold text-gray-600 hover:bg-gray-200 transition-colors"
                        >
                            キャンセル
                        </button>
                        <button
                            type="submit"
                            disabled={!formData.name.trim() || isSubmitting}
                            className="flex-1 py-3 bg-blue-600 rounded-lg font-bold text-white shadow-lg hover:bg-blue-700 hover:shadow-xl transition-all disabled:opacity-50 disabled:shadow-none"
                        >
                            {isSubmitting ? "登録中..." : "登録する"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
