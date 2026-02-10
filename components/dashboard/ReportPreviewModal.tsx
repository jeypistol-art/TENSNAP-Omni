"use client";

import React, { ReactNode } from "react";

type ReportPreviewModalProps = {
    isOpen: boolean;
    onClose: () => void;
    onPrint?: () => void;
    title: string;
    children: ReactNode;
    showActions?: boolean;
};

export default function ReportPreviewModal({ isOpen, onClose, onPrint, title, children, showActions = true }: ReportPreviewModalProps) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-gray-100 w-full max-w-5xl h-[90vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
                {/* Modal Header */}
                <div className="bg-white px-6 py-4 border-b border-gray-200 flex justify-between items-center flex-shrink-0">
                    <div>
                        <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                            <span className="text-blue-600">📄</span> {title}
                        </h3>
                        {/* Instructional Text for PDF Save */}
                        {showActions && (
                            <p className="text-[11px] text-gray-500 mt-1 font-medium">
                                ※ PDFを保存する場合、『印刷』画面の『送信先』や『プリンター』から「PDFに保存」を選択してください
                            </p>
                        )}
                    </div>
                    <div className="flex gap-3">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 text-sm font-bold text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                            閉じる
                        </button>

                        {showActions && onPrint && (
                            <button
                                onClick={onPrint}
                                className="px-6 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-md transition-all flex items-center gap-2"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                                印刷 / PDF保存
                            </button>
                        )}
                    </div>
                </div>

                {/* Modal Content (Scrollable Report Preview) */}
                <div className="flex-1 overflow-auto p-8 bg-gray-500/20 custom-scrollbar flex justify-center">
                    <div className="scale-90 origin-top shadow-2xl">
                        {children}
                    </div>
                </div>
            </div>
        </div>
    );
}
