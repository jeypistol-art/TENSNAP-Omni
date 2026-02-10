"use client";

import { useState, useEffect } from "react";
import { PlusCircle } from "lucide-react";

type Student = {
    id: string;
    name: string;
    name_kana?: string;
    grade?: string;
    target_school?: string;
};

type Props = {
    selectedStudentId: string;
    onSelect: (studentId: string) => void;
    onOpenModal: () => void;
    // Passing 'students' prop from parent (Dashboard) to avoid re-fetching or control refreshing
    students: Student[];
};

export default function StudentSelector({ selectedStudentId, onSelect, onOpenModal, students }: Props) {


    // Filter Logic
    const [filterRow, setFilterRow] = useState<string>("ALL");

    // Hiragana Rows
    const ROWS: { [key: string]: string[] } = {
        'あ': ['あ', 'い', 'う', 'え', 'お'],
        'か': ['か', 'き', 'く', 'け', 'こ', 'が', 'ぎ', 'ぐ', 'げ', 'ご'],
        'さ': ['さ', 'し', 'す', 'せ', 'そ', 'ざ', 'じ', 'ず', 'ぜ', 'ぞ'],
        'た': ['た', 'ち', 'つ', 'て', 'と', 'だ', 'ぢ', 'づ', 'で', 'ど'],
        'な': ['な', 'に', 'ぬ', 'ね', 'の'],
        'は': ['は', 'ひ', 'ふ', 'へ', 'ほ', 'ば', 'び', 'ぶ', 'べ', 'ぼ', 'ぱ', 'ぴ', 'ぷ', 'ぺ', 'ぽ'],
        'ま': ['ま', 'み', 'む', 'め', 'も'],
        'や': ['や', 'ゆ', 'よ'],
        'ら': ['ら', 'り', 'る', 'れ', 'ろ'],
        'わ': ['わ', 'を', 'ん'],
    };

    const filteredStudents = students.filter(s => {
        if (filterRow === "ALL") return true;
        if (!s.name_kana) return false; // Hide if no kana
        const firstChar = s.name_kana.charAt(0);
        return ROWS[filterRow]?.includes(firstChar);
    });

    return (
        <div className="mb-6 p-4 bg-white rounded-xl border border-gray-100 shadow-sm animate-in fade-in slide-in-from-bottom-2">
            <div className="flex flex-col gap-4">
                {/* 1. Hiragana Filter Buttons */}
                <div>
                    <label className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">五十音絞り込み (ふりがな)</label>
                    <div className="flex flex-wrap gap-1">
                        <button
                            onClick={() => setFilterRow("ALL")}
                            className={`px-3 py-1 text-xs font-bold rounded-md transition-colors ${filterRow === "ALL" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200"}`}
                        >
                            全て
                        </button>
                        {Object.keys(ROWS).map(row => (
                            <button
                                key={row}
                                onClick={() => setFilterRow(row)}
                                className={`px-3 py-1 text-xs font-bold rounded-md transition-colors ${filterRow === row ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200"}`}
                            >
                                {row}行
                            </button>
                        ))}
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <div className="flex-1">
                        {/* <label className="block text-xs font-bold text-gray-500 mb-1 uppercase tracking-wider">対象生徒を選択</label> */}
                        <select
                            className="w-full p-2.5 border border-gray-300 rounded-lg bg-gray-50 text-gray-700 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow"
                            value={selectedStudentId}
                            onChange={(e) => onSelect(e.target.value)}
                        >
                            <option value="">-- 生徒を選択してください {filterRow !== "ALL" ? `(${filterRow}行)` : ""} --</option>
                            {filteredStudents.map((s) => (
                                <option key={s.id} value={s.id}>
                                    {s.name} {s.name_kana ? `(${s.name_kana})` : ""} {s.grade ? ` / ${s.grade}` : ""}
                                </option>
                            ))}
                            {filteredStudents.length === 0 && <option disabled>該当する生徒がいません</option>}
                        </select>
                    </div>

                    <button
                        onClick={onOpenModal}
                        className="flex items-center gap-2 px-4 py-2.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors text-sm font-bold shadow-sm whitespace-nowrap"
                    >
                        <PlusCircle size={18} />
                        新規登録
                    </button>
                </div>
            </div>
        </div>
    );
}
