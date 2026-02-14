import Link from "next/link";

export default function ManualPage() {
    return (
        <div className="max-w-4xl mx-auto py-8">
            <h1 className="text-3xl font-bold mb-8 text-center text-mizuho dark:text-blue-400">TENsNAP・Omni 導入・運用マニュアル</h1>

            <div className="space-y-16">

                {/* 0. Concept */}
                <section>
                    <h2 className="text-2xl font-bold mb-4 border-b-2 border-mizuho dark:border-blue-500 pb-2 inline-block">0. Concept</h2>
                    <p className="text-xl font-medium text-foreground mb-2">採点を超えた、その先へ</p>
                    <p className="leading-relaxed text-muted-foreground">
                        「先生の時間は、生徒の未来のために。<br />
                        TENsNAP・Omniは、採点の手間を『分析の深さ』に変えるパートナーです。」
                    </p>
                </section>

                {/* 1. 準備 */}
                <section>
                    <h2 className="text-2xl font-bold mb-6 border-b-2 border-mizuho dark:border-blue-500 pb-2 inline-block">1. 準備：生徒を登録する</h2>
                    <p className="mb-4 text-lg">最短30秒で、AIのパーソナル・カルテが準備されます。</p>

                    <div className="grid md:grid-cols-2 gap-8 items-start">
                        <div className="space-y-4">
                            <ul className="list-disc pl-5 space-y-2 text-muted-foreground">
                                <li>
                                    <strong className="text-foreground">「＋新規登録」</strong>をクリックし、氏名を記入（必須）。
                                </li>
                                <li>
                                    <strong className="text-foreground">ふりがな</strong>: 入力すると五十音検索が有効になり、現場での抽出が爆速になります。
                                </li>
                            </ul>
                            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-100 dark:border-blue-800">
                                <p className="text-sm font-bold text-mizuho dark:text-blue-300 mb-1">💡 AIへのヒント（備考欄）</p>
                                <p className="text-sm text-muted-foreground">
                                    「数学が苦手」など一言添えるだけで、分析の「着眼点」がプロ仕様に研ぎ澄まされます。
                                </p>
                            </div>
                        </div>
                        <div className="rounded-xl overflow-hidden border border-gray-200 shadow-md">
                            <img src="/images/manual/01seito_touroku.png" alt="生徒登録画面" className="w-full h-auto" />
                        </div>
                    </div>
                </section>

                {/* 2. 実行 */}
                <section>
                    <h2 className="text-2xl font-bold mb-6 border-b-2 border-mizuho dark:border-blue-500 pb-2 inline-block">2. 実行：スキャンして分析を開始</h2>
                    <p className="mb-4 text-lg">画像加工は一切不要。AIが「ありのまま」を読み取ります。</p>

                    <div className="space-y-6">
                        <div className="flex items-start gap-4">
                            <div className="bg-mizuho text-white rounded-full w-8 h-8 flex items-center justify-center flex-shrink-0 font-bold">1</div>
                            <div>
                                <h3 className="font-bold text-lg mb-1">生徒を選択</h3>
                                <p className="text-muted-foreground">五十音サジェストから、対象の生徒を直感的に選択。</p>
                            </div>
                        </div>

                        <div className="flex items-start gap-4">
                            <div className="bg-mizuho text-white rounded-full w-8 h-8 flex items-center justify-center flex-shrink-0 font-bold">2</div>
                            <div>
                                <h3 className="font-bold text-lg mb-1">前提情報の入力</h3>
                                <p className="text-muted-foreground">教科・単元を選択。「受験期モード」ONで、鬼の宣告（実戦的評価）が発動します。</p>
                            </div>
                        </div>

                        <div className="flex items-start gap-4">
                            <div className="bg-gray-500 text-white rounded-full w-8 h-8 flex items-center justify-center flex-shrink-0 font-bold">3</div>
                            <div>
                                <h3 className="font-bold text-lg mb-1">問題用紙をドロップ（任意）</h3>
                                <p className="text-muted-foreground">まとめてドラッグ。天地・順序は自動判別。登録により精度が最大化します。</p>
                            </div>
                        </div>

                        <div className="flex items-start gap-4">
                            <div className="bg-red-500 text-white rounded-full w-8 h-8 flex items-center justify-center flex-shrink-0 font-bold">4</div>
                            <div>
                                <h3 className="font-bold text-lg mb-1">答案をドロップ（必須）</h3>
                                <p className="text-muted-foreground">生徒の生きた証をそのままAIへ。分析結果は数秒で生成されます。</p>
                            </div>
                        </div>
                    </div>
                </section>

                {/* 3. 出力 */}
                <section>
                    <h2 className="text-2xl font-bold mb-6 border-b-2 border-mizuho dark:border-blue-500 pb-2 inline-block">3. 出力：成長を可視化し、面談の武器に</h2>
                    <p className="mb-4 text-lg">分析結果は、そのまま「保護者への信頼」に変わります。</p>

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
                            <p className="text-muted-foreground text-sm">期間を指定してボタンを押すだけ。生徒の「弱点」と「一言評価」がまとまった、即戦力の面談資料が出力されます。</p>
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
                                <span className="text-muted-foreground">提出された画像や個人情報は、貴塾の分析のみに使用されます。</span>
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
                                <dt className="text-sm text-muted-foreground font-bold">初期費用</dt>
                                <dd className="text-lg font-medium">50,000円</dd>
                            </div>
                            <div>
                                <dt className="text-sm text-muted-foreground font-bold">月額利用料</dt>
                                <dd className="text-lg font-medium">9,800円（サブスクリプション）</dd>
                            </div>
                            <div className="md:col-span-2 pt-4 border-t border-gray-200 dark:border-gray-700">
                                <dt className="text-sm text-muted-foreground font-bold">無料トライアル</dt>
                                <dd className="text-lg font-medium">14日間（期間終了後はデータ消去）</dd>
                            </div>
                            <div className="md:col-span-2">
                                <dt className="text-sm text-red-500 font-bold">早期契約特典</dt>
                                <dd className="text-lg font-bold text-red-600">トライアル開始から7日以内の本契約で初期費用50％OFF</dd>
                            </div>
                        </dl>
                    </div>
                </section>

                {/* 6. お問い合わせ */}
                <section id="contact">
                    <h2 className="text-2xl font-bold mb-6 border-b-2 border-mizuho dark:border-blue-500 pb-2 inline-block">6. お問い合わせ</h2>
                    <p className="mb-6">不具合やご要望、カスタマイズの相談はこちらまで。</p>

                    <div className="w-full relative overflow-hidden rounded-lg border border-gray-200 bg-white" style={{ minHeight: "1250px" }}>
                        <iframe
                            src="https://docs.google.com/forms/d/e/1FAIpQLSeYAfanw069KMQxf0OFg4_uXy3WvKnNMJ2nIqtwLxLwXVKtuQ/viewform?embedded=true"
                            width="100%"
                            height="1177"
                            frameBorder="0"
                            marginHeight={0}
                            marginWidth={0}
                            title="お問い合わせフォーム"
                            style={{ width: "100%", height: "1200px" }}
                        >
                            読み込んでいます…
                        </iframe>
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
