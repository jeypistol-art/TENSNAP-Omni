import Link from "next/link";

export const metadata = {
    title: "ご家庭向けマニュアル",
    robots: {
        index: false,
        follow: true,
    },
};

export default function ManualPage() {
    return (
        <div className="max-w-4xl mx-auto py-8">
            <h1 className="text-3xl font-bold mb-8 text-center text-mizuho dark:text-blue-400">
                TENsNAP・Omni ご家庭向けマニュアル
            </h1>

            <div className="space-y-16">
                {/* 0. Concept */}
                <section>
                    <h2 className="text-2xl font-bold mb-4 border-b-2 border-mizuho dark:border-blue-500 pb-2 inline-block">0. Concept</h2>
                    <p className="text-xl font-medium text-foreground mb-2">採点も一つの学習。</p>
                    <p className="leading-relaxed text-muted-foreground">
                        TENsNAPは採点せず、お子様の成長率、苦手単元、次の一手を分析します。<br />
                        より効果的な学習、やる気の持続にお役立てください。
                    </p>
                </section>

                {/* 1. 実行 */}
                <section>
                    <h2 className="text-2xl font-bold mb-6 border-b-2 border-mizuho dark:border-blue-500 pb-2 inline-block">1. 実行：スキャンして分析を開始</h2>
                    <p className="mb-4 text-lg">
                        画像加工は一切不要。<br />
                        問題用紙が複数ある場合、順番も天地も、見開きでも心配ありません。<br />
                        AIが整えて分析してくれます。<br />
                        問題と答案が一体化したタイプのテストは、答案用紙のみスキャンで分析できます。
                    </p>

                    <div className="space-y-6">
                        <div className="flex items-start gap-4">
                            <div className="bg-mizuho text-white rounded-full w-8 h-8 flex items-center justify-center flex-shrink-0 font-bold">1</div>
                            <div>
                                <h3 className="font-bold text-lg mb-1">前提情報の入力</h3>
                                <p className="text-muted-foreground">教科・単元を選択。「受験期モード」ONで、鬼の宣告（実戦的評価）が発動します。</p>
                            </div>
                        </div>

                        <div className="flex items-start gap-4">
                            <div className="bg-gray-500 text-white rounded-full w-8 h-8 flex items-center justify-center flex-shrink-0 font-bold">2</div>
                            <div>
                                <h3 className="font-bold text-lg mb-1">問題用紙をドロップ（任意）</h3>
                                <p className="text-muted-foreground">まとめてドラッグ。天地・順序は自動判別。登録により精度が最大化します。</p>
                            </div>
                        </div>

                        <div className="flex items-start gap-4">
                            <div className="bg-red-500 text-white rounded-full w-8 h-8 flex items-center justify-center flex-shrink-0 font-bold">3</div>
                            <div>
                                <h3 className="font-bold text-lg mb-1">答案をドロップ（必須）</h3>
                                <p className="text-muted-foreground">分析結果は数秒で生成されます。</p>
                            </div>
                        </div>
                    </div>
                </section>

                {/* 3. 出力 */}
                <section>
                    <h2 className="text-2xl font-bold mb-6 border-b-2 border-mizuho dark:border-blue-500 pb-2 inline-block">3. 出力：成長を可視化し、次の武器に</h2>
                    <p className="mb-4 text-lg">分析結果は、答案のスキャン結果と、履歴から期間ごとの成長とで閲覧できます。</p>

                    <div className="grid md:grid-cols-3 gap-6">
                        <div className="bg-white dark:bg-card p-6 rounded-xl border border-gray-200 shadow-sm">
                            <h3 className="font-bold text-lg mb-2">履歴閲覧</h3>
                            <p className="text-muted-foreground text-sm">「成長トレンド」グラフで、努力の軌跡を一目で把握。</p>
                        </div>
                        <div className="bg-white dark:bg-card p-6 rounded-xl border border-gray-200 shadow-sm">
                            <h3 className="font-bold text-lg mb-2">PDF保存・印刷</h3>
                            <p className="text-muted-foreground text-sm">各種ブラウザの印刷設定から「PDF保存」を選択。</p>
                        </div>
                        <div className="bg-white dark:bg-card p-6 rounded-xl border border-gray-200 shadow-sm">
                            <h3 className="font-bold text-lg mb-2">期間成長レポート</h3>
                            <p className="text-muted-foreground text-sm">期間を指定してボタンを押すだけ。「弱点」と「一言評価」がまとまった、即戦力の面談資料が出力されます。</p>
                        </div>
                    </div>
                </section>

                {/* 4. 安心の思想とポリシー */}
                <section>
                    <h2 className="text-2xl font-bold mb-6 border-b-2 border-mizuho dark:border-blue-500 pb-2 inline-block">4. 安心の思想とポリシー</h2>
                    <ul className="space-y-3">
                        <li className="flex items-start gap-3">
                            <span className="text-green-500 mt-1">✓</span>
                            <div>
                                <strong className="block text-foreground">AIの学習に利用されません</strong>
                                <span className="text-muted-foreground">提出された画像や個人情報は、分析のみに使用されます。</span>
                            </div>
                        </li>
                        <li className="flex items-start gap-3">
                            <span className="text-green-500 mt-1">✓</span>
                            <div>
                                <strong className="block text-foreground">自動消去</strong>
                                <span className="text-muted-foreground">解析結果や画像は、プライバシー保護のため厳格に管理されます。</span>
                            </div>
                        </li>
                        <li className="flex items-start gap-3">
                            <span className="text-blue-500 mt-1">ℹ</span>
                            <div>
                                <strong className="block text-foreground">受験期モードの使い分け</strong>
                                <span className="text-muted-foreground block">
                                    <span className="font-bold">OFF:</span> メモや空欄も「成長の芽」としてポジティブに評価。<br />
                                    <span className="font-bold">ON:</span> 正答率と精度を重視し、合格への「残酷な真実」を提示。
                                </span>
                            </div>
                        </li>
                    </ul>
                </section>

                {/* 5. ご利用プランと規約 */}
                <section>
                    <h2 className="text-2xl font-bold mb-6 border-b-2 border-mizuho dark:border-blue-500 pb-2 inline-block">5. ご利用プランと規約</h2>
                    <div className="bg-gray-50 dark:bg-gray-800 p-6 rounded-xl border border-gray-200">
                        <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                            <div>
                                <dt className="text-sm text-muted-foreground font-bold">月額利用料</dt>
                                <dd className="text-lg font-medium">2,980円（サブスクリプション）</dd>
                            </div>
                            <div className="md:col-span-2 pt-4 border-t border-gray-200 dark:border-gray-700">
                                <dt className="text-sm text-muted-foreground font-bold">無料トライアル</dt>
                                <dd className="text-lg font-medium">14日間（期間終了後はデータ消去）</dd>
                            </div>
                        </dl>
                        <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700 text-sm text-muted-foreground space-y-1">
                            <p>※無料トライアル終了後、本契約がなければ14日後にデータは消去されます</p>
                            <p>※サブスクリプション解約後、14日間でデータは消去されます</p>
                            <p>※データ消去前に、サブスクリプションを再購入した場合は、データを継続できます</p>
                        </div>
                    </div>
                </section>
            </div>

            <div className="mt-12 pt-8 border-t border-gray-200 text-center">
                <Link href="/dashboard" className="text-mizuho dark:text-blue-400 hover:underline font-bold">
                    ← ダッシュボードに戻る
                </Link>
            </div>
        </div>
    );
}
