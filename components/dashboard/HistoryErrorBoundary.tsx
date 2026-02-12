"use client";

import React from "react";

type Props = {
    children: React.ReactNode;
};

type State = {
    hasError: boolean;
};

export default class HistoryErrorBoundary extends React.Component<Props, State> {
    state: State = { hasError: false };

    static getDerivedStateFromError(): State {
        return { hasError: true };
    }

    componentDidCatch(error: unknown, info: unknown) {
        console.error("History UI Error:", error, info);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="p-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg">
                    履歴表示でエラーが発生しました。ページを再読み込みしてください。
                </div>
            );
        }
        return this.props.children;
    }
}
