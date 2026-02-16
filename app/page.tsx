import { getServerSession } from "next-auth";
import { authOptions } from "./api/auth/[...nextauth]/route";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle,
  Zap,
  Layout,
  FileText,
  Smartphone,
  TrendingUp,
  Lock,
  Users
} from "lucide-react";

function hasForceLogoutError(session: unknown): boolean {
  if (!session || typeof session !== "object") return false;
  const maybe = session as { error?: unknown };
  return maybe.error === "ForceLogout";
}

export const metadata = {
  alternates: {
    canonical: 'https://10snap.win',
  },
  keywords: ['TENsNAP', '教育AI', '塾運営効率化', '答案分析', '成績管理', '指導改善'],
};

export default async function Home() {
  const session = await getServerSession(authOptions);

  if (session && !hasForceLogoutError(session)) {
    redirect("/dashboard");
  }

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground overflow-x-hidden">
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex-shrink-0 flex items-center">
              <span className="text-2xl font-bold text-mizuho dark:text-blue-400">TENsNAP・Omni</span>
            </div>
            <div className="flex items-center space-x-4">
              <Link
                href="/login"
                className="text-sm font-medium text-muted-foreground hover:text-mizuho dark:hover:text-blue-400 transition-colors"
              >
                ログイン
              </Link>
              <Link
                href="/login"
                className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-mizuho hover:bg-blue-800 transition-colors dark:bg-blue-600 dark:hover:bg-blue-700 shadow-sm"
              >
                無料で始める
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 lg:pt-48 lg:pb-32 overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center max-w-4xl mx-auto">
            <h1 className="text-4xl sm:text-5xl lg:text-7xl font-extrabold tracking-tight text-foreground mb-8 text-balance">
              <span className="block text-mizuho dark:text-blue-400">学習理解度を可視化</span>
              <span className="block mt-2">指導を改善する分析支援システム</span>
            </h1>
            <p className="mt-4 text-xl sm:text-2xl text-muted-foreground max-w-2xl mx-auto mb-10 text-balance">
              採点後の答案用紙をスキャンするだけ。<br className="hidden sm:block" />
              成長率、弱点、次の一手が瞬時に分かる。
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-4">
              <Link
                href="/login"
                className="inline-flex items-center justify-center px-8 py-4 text-lg font-bold rounded-full text-white bg-mizuho hover:bg-blue-800 transition-all dark:bg-blue-600 dark:hover:bg-blue-700 shadow-lg hover:shadow-xl transform hover:-translate-y-1"
              >
                今すぐ体験する
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </div>
            <p className="mt-6 text-sm text-muted-foreground">
              機材投資ゼロ・PC/スマホ対応・高度なセキュリティ
            </p>
          </div>
        </div>

        {/* Abstract Background Elements */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10 opacity-30 dark:opacity-10 pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-200 rounded-full mix-blend-multiply filter blur-3xl animate-blob"></div>
          <div className="absolute top-1/3 right-1/4 w-96 h-96 bg-cyan-200 rounded-full mix-blend-multiply filter blur-3xl animate-blob animation-delay-2000"></div>
          <div className="absolute bottom-1/4 left-1/3 w-96 h-96 bg-indigo-200 rounded-full mix-blend-multiply filter blur-3xl animate-blob animation-delay-4000"></div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="py-24 bg-muted/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-base font-semibold text-mizuho dark:text-blue-400 tracking-wide uppercase">Features</h2>
            <p className="mt-2 text-3xl font-extrabold text-foreground sm:text-4xl">
              AIが講師の「目」を拡張する
            </p>
            <p className="mt-4 max-w-2xl text-xl text-muted-foreground mx-auto">
              事務作業を最小限に抑え、生徒と向き合う時間を最大化するための直感的なツール群。
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
            {[
              {
                icon: <FileText className="h-8 w-8 text-white" />,
                title: "画像ドラッグで一括登録",
                desc: "問題用紙も解答用紙も、画像の向きや順番を気にせずドラッグ＆ドロップで放り込むだけ。AIが自動で整理します。",
                color: "bg-blue-500"
              },
              {
                icon: <TrendingUp className="h-8 w-8 text-white" />,
                title: "成長トレンド分析",
                desc: "過去の分析結果を一覧表示し、人目で成績の動きが分かるグラフを生成。生徒の「伸び」を逃しません。",
                color: "bg-indigo-500"
              },
              {
                icon: <Layout className="h-8 w-8 text-white" />,
                title: "自動資料作成",
                desc: "データをまとめて資料作りに費やしていた数時間を、わずか数分に短縮。PDFとして即保存・印刷可能です。",
                color: "bg-cyan-500"
              },
            ].map((feature, idx) => (
              <div key={idx} className="bg-card rounded-2xl p-8 shadow-sm border border-border hover:shadow-md transition-shadow">
                <div className={`inline-flex items-center justify-center p-3 rounded-xl ${feature.color} shadow-lg mb-6`}>
                  {feature.icon}
                </div>
                <h3 className="text-xl font-bold text-foreground mb-3">{feature.title}</h3>
                <p className="text-muted-foreground leading-relaxed">
                  {feature.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Value Proposition (The "Weapon" Section) */}
      <section className="py-24 overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="lg:grid lg:grid-cols-2 lg:gap-16 items-center">
            <div className="mb-12 lg:mb-0">
              <div className="inline-flex items-center px-4 py-2 rounded-full bg-blue-100 dark:bg-blue-900/30 text-mizuho dark:text-blue-300 font-semibold text-sm mb-6">
                <Zap className="h-4 w-4 mr-2" />
                保護者面談の最強の武器
              </div>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-foreground mb-6">
                「感覚」だけではない。<br />
                「客観的エビデンス」で信頼を勝ち取る。
              </h2>
              <p className="text-lg text-muted-foreground mb-8 leading-relaxed">
                単なる点数の報告ではなく、説得力のあるグラフ付きPDFレポートが、
                保護者への信頼感を劇的に高めます。<br /><br />
                「ここが弱点です」と口で言うのと、データで示すのでは、
                説得力が段違いです。
              </p>

              <ul className="space-y-4">
                {[
                  "生徒ごとの詳細な弱点分析リスト",
                  "期間・教科ごとの成長推移グラフ",
                  "ワンクリックで印刷用PDF生成"
                ].map((item, i) => (
                  <li key={i} className="flex items-start">
                    <CheckCircle className="h-6 w-6 text-green-500 mr-3 flex-shrink-0" />
                    <span className="text-foreground font-medium">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="relative">
              {/* Abstract Placeholder for Screenshot/Graph */}
              <div className="aspect-[4/3] rounded-2xl bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-900 border border-border shadow-2xl flex items-center justify-center relative overflow-hidden group">
                <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1551288049-bebda4e38f71?q=80&w=2670&auto=format&fit=crop')] bg-cover bg-center opacity-70 group-hover:scale-105 transition-transform duration-700"></div>
                <div className="absolute inset-0 bg-gradient-to-t from-background/90 to-transparent"></div>
                <div className="relative z-10 text-center p-8">
                  <TrendingUp className="h-16 w-16 text-mizuho dark:text-blue-400 mx-auto mb-4" />
                  <p className="text-xl font-bold">成長トレンドを見える化</p>
                </div>
              </div>

              {/* Floating Badge */}
              <div className="absolute -bottom-6 -left-6 bg-card p-4 rounded-xl shadow-xl border border-border flex items-center gap-4 animate-bounce-slow">
                <div className="bg-green-100 dark:bg-green-900/30 p-2 rounded-full">
                  <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase font-semibold">Time Saved</p>
                  <p className="text-lg font-bold text-foreground">平均 4.5時間 / 週</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Zero Equipment & Mobile First */}
      <section className="py-24 bg-mizuho text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="lg:grid lg:grid-cols-2 lg:gap-16 items-center">
            <div className="order-2 lg:order-1 relative">
              <div className="mx-auto w-64 h-[500px] bg-gray-900 rounded-[3rem] border-[8px] border-gray-800 shadow-2xl overflow-hidden relative">
                <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-32 h-6 bg-gray-800 rounded-b-2xl"></div>
                <div className="w-full h-full bg-white dark:bg-gray-900 flex items-center justify-center overflow-hidden">
                  <img src="https://images.unsplash.com/photo-1550751827-4bd374c3f58b?q=80&w=2670&auto=format&fit=crop" alt="App Screen" className="w-full h-full object-cover" />
                </div>
              </div>
            </div>
            <div className="order-1 lg:order-2 mb-12 lg:mb-0">
              <h2 className="text-3xl sm:text-4xl font-extrabold mb-6">
                機材投資ゼロ。<br />
                今あるスマホがスキャナーに。
              </h2>
              <p className="text-blue-100 text-lg mb-8 leading-relaxed">
                高価な専用スキャナーや複雑なセットアップは一切不要です。<br />
                お手持ちのスマートフォンやタブレットで撮影するだけで、
                高度な画像処理AIが書類を認識・補正します。<br /><br />
                PC、タブレット、スマホ。1アカウントにつき2デバイスまで、
                教室の環境に合わせて自由に使い分けられます。
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex items-center gap-3 bg-white/10 backdrop-blur-sm p-4 rounded-lg">
                  <Smartphone className="h-6 w-6 text-blue-300" />
                  <span className="font-medium">スマホ完結</span>
                </div>
                <div className="flex items-center gap-3 bg-white/10 backdrop-blur-sm p-4 rounded-lg">
                  <Users className="h-6 w-6 text-blue-300" />
                  <span className="font-medium">2台まで同時利用可</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Trust & Security */}
      <section className="py-24 bg-background">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl font-bold text-foreground mb-12">
            教育現場だからこそ、<br className="sm:hidden" />妥協しない安全性と使いやすさ
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-left">
            <div className="bg-muted/30 p-8 rounded-2xl border border-border">
              <div className="flex items-center mb-4">
                <Lock className="h-6 w-6 text-mizuho dark:text-blue-400 mr-3" />
                <h3 className="text-lg font-bold">鉄壁のセキュリティ</h3>
              </div>
              <p className="text-muted-foreground text-sm leading-relaxed">
                個人情報は高度に暗号化され、解析に使用した画像は一定期間で自動消去されます。
                また、AIが情報を学習・記憶することのない設計を採用しており、
                生徒の大切なデータを安全に守ります。
              </p>
            </div>
            <div className="bg-muted/30 p-8 rounded-2xl border border-border">
              <div className="flex items-center mb-4">
                <Users className="h-6 w-6 text-mizuho dark:text-blue-400 mr-3" />
                <h3 className="text-lg font-bold">パスワードレス認証</h3>
              </div>
              <p className="text-muted-foreground text-sm leading-relaxed">
                面倒で、漏洩リスクのあるパスワードは不要です。
                メールリンクやGoogle認証による高度なログインシステムを採用し、
                安全かつスムーズなアクセスを実現します。
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Usage Flow */}
      <section className="py-24 bg-muted/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-extrabold text-foreground sm:text-4xl mb-4">
              ご利用の流れ
            </h2>
            <p className="text-xl text-muted-foreground">
              まずは無料トライアルから。面倒な契約手続きは不要です。
            </p>
          </div>

          <div className="max-w-4xl mx-auto relative">
            {/* Vertical Line */}
            <div className="absolute left-4 md:left-1/2 top-0 bottom-0 w-0.5 bg-border transform md:-translate-x-1/2"></div>

            <div className="space-y-12 relative">
              {/* Step 1 */}
              <div className="md:flex items-center justify-between group">
                <div className="md:w-[45%] mb-4 md:mb-0 md:text-right order-1">
                  <h3 className="text-xl font-bold bg-white dark:bg-card border-2 border-mizuho dark:border-blue-500 text-mizuho dark:text-blue-400 inline-block px-4 py-1 rounded-full mb-2">STEP 01</h3>
                  <h4 className="text-lg font-bold">2週間の無料トライアル</h4>
                  <p className="text-muted-foreground mt-2">
                    まずは全ての機能を無料でお試しください。<br />
                    クレジットカードも個人情報も登録不要。<br />
                    煩わしい営業連絡も一切ありません。
                  </p>
                </div>
                <div className="absolute left-4 md:left-1/2 w-4 h-4 bg-mizuho dark:bg-blue-500 rounded-full border-4 border-white dark:border-gray-900 md:-translate-x-1/2 transform -translate-x-1/2 mt-1.5 md:mt-0 z-10"></div>
                <div className="md:w-[45%] pl-12 md:pl-0 order-2"></div>
              </div>

              {/* Step 2 */}
              <div className="md:flex items-center justify-between group">
                <div className="md:w-[45%] mb-4 md:mb-0 order-1 md:order-2">
                  <div className="pl-12 md:pl-0">
                    <h3 className="text-xl font-bold bg-white dark:bg-card border-2 border-indigo-500 text-indigo-500 inline-block px-4 py-1 rounded-full mb-2">STEP 02</h3>
                    <h4 className="text-lg font-bold">トライアル期間中</h4>
                    <p className="text-muted-foreground mt-2">
                      機能に満足いただければ、期間中でもいつでも本契約へ移行可能です。<br />
                      <span className="font-bold text-red-500">7日以内の本契約で初期費用が50%OFF</span>になる特典もご用意しています。
                    </p>
                  </div>
                </div>
                <div className="absolute left-4 md:left-1/2 w-4 h-4 bg-indigo-500 rounded-full border-4 border-white dark:border-gray-900 md:-translate-x-1/2 transform -translate-x-1/2 mt-1.5 md:mt-0 z-10"></div>
                <div className="md:w-[45%] order-2 md:order-1"></div>
              </div>

              {/* Step 3 */}
              <div className="md:flex items-center justify-between group">
                <div className="md:w-[45%] mb-4 md:mb-0 md:text-right order-1">
                  <h3 className="text-xl font-bold bg-white dark:bg-card border-2 border-gray-400 text-gray-500 inline-block px-4 py-1 rounded-full mb-2">STEP 03</h3>
                  <h4 className="text-lg font-bold">トライアル満了後</h4>
                  <p className="text-muted-foreground mt-2">
                    期間が終了すると自動的に利用停止となります。<br />
                    勝手に課金されることはありません。<br />
                    本契約を行うことで、データを引き継いで利用を再開できます。
                  </p>
                </div>
                <div className="absolute left-4 md:left-1/2 w-4 h-4 bg-gray-400 rounded-full border-4 border-white dark:border-gray-900 md:-translate-x-1/2 transform -translate-x-1/2 mt-1.5 md:mt-0 z-10"></div>
                <div className="md:w-[45%] pl-12 md:pl-0 order-2"></div>
              </div>

              {/* Step 4 */}
              <div className="md:flex items-center justify-between group">
                <div className="md:w-[45%] mb-4 md:mb-0 order-1 md:order-2">
                  <div className="pl-12 md:pl-0">
                    <h3 className="text-xl font-bold bg-white dark:bg-card border-2 border-green-500 text-green-500 inline-block px-4 py-1 rounded-full mb-2">Settings</h3>
                    <h4 className="text-lg font-bold">解約も簡単</h4>
                    <p className="text-muted-foreground mt-2">
                      解約は「設定」画面からいつでもクリック一つで完了します。<br />
                      引き止めや電話手続きは不要です。<br />
                      いつでも気兼ねなく開始・停止が可能です。
                    </p>
                  </div>
                </div>
                <div className="absolute left-4 md:left-1/2 w-4 h-4 bg-green-500 rounded-full border-4 border-white dark:border-gray-900 md:-translate-x-1/2 transform -translate-x-1/2 mt-1.5 md:mt-0 z-10"></div>
                <div className="md:w-[45%] order-2 md:order-1"></div>
              </div>

            </div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-24 bg-background">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-extrabold text-foreground sm:text-4xl mb-6">
            料金プラン
          </h2>
          <p className="text-xl text-muted-foreground mb-12">
            シンプルで透明性の高い料金体系。<br />
            生徒数が増えても料金は変わりません。
          </p>

          <div className="bg-white dark:bg-card rounded-2xl shadow-xl border border-mizuho/20 dark:border-blue-500/30 p-8 md:p-12 relative overflow-hidden">
            <div className="absolute top-0 right-0 bg-red-500 text-white text-xs font-bold px-8 py-2 transform rotate-45 translate-x-8 translate-y-4 shadow-md">
              Early Bird Offer
            </div>

            <div className="grid md:grid-cols-2 gap-8 items-center divide-y md:divide-y-0 md:divide-x divide-gray-200 dark:divide-gray-700">
              <div className="pb-8 md:pb-0 md:pr-8">
                <h3 className="text-lg font-semibold text-muted-foreground uppercase tracking-wide mb-2">初期費用</h3>
                <div className="flex flex-col items-center justify-center">
                  <span className="text-gray-400 line-through text-lg">¥50,000</span>
                  <div className="flex items-end gap-2">
                    <span className="text-4xl font-bold text-foreground">¥25,000</span>
                    <span className="text-sm text-muted-foreground mb-1">（税込）</span>
                  </div>
                  <p className="text-red-500 text-sm font-bold mt-2 bg-red-50 dark:bg-red-900/20 px-3 py-1 rounded-full">
                    登録後7日以内の契約で50%OFF
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">通常価格: ¥50,000</p>
                </div>
              </div>
              <div className="pt-8 md:pt-0 md:pl-8">
                <h3 className="text-lg font-semibold text-muted-foreground uppercase tracking-wide mb-2">月額利用料</h3>
                <div className="flex items-end justify-center gap-2">
                  <span className="text-5xl font-extrabold text-mizuho dark:text-blue-400">¥9,800</span>
                  <span className="text-sm text-muted-foreground mb-2">（税込）/ 月</span>
                </div>
                <p className="text-sm text-muted-foreground mt-4">
                  1アカウントにつき2デバイスまで<br />
                  生徒数無制限
                </p>
              </div>
            </div>

            <div className="mt-8 pt-8 border-t border-gray-100 dark:border-gray-800 text-sm text-muted-foreground">
              <p>※お支払いはクレジットカードのみとなります。</p>
              <div className="mt-4 space-y-1 text-xs">
                <p>※無料トライアル終了後、本契約がなければ14日後にデータは消去されます</p>
                <p>※サブスクリプション解約後、14日間でデータは消去されます</p>
                <p>※データ消去前に、サブスクリプションを再購入した場合は、データを継続できます</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Footer */}
      <section className="py-20 bg-muted/50 border-t border-border">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-foreground mb-6">
            塾の指導品質を、<br />
            次のレベルへ。
          </h2>
          <p className="text-xl text-muted-foreground mb-10">
            事務作業を減らし、生徒の成長に向き合う時間を。<br />
            まずは無料でお試しください。
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4 mb-16">
            <Link
              href="/login"
              className="inline-flex items-center justify-center px-8 py-4 text-lg font-bold rounded-lg text-white bg-mizuho hover:bg-blue-800 transition-colors dark:bg-blue-600 dark:hover:bg-blue-700 shadow-md"
            >
              無料でアカウント作成
            </Link>
          </div>
        </div>
      </section>

      {/* Site Footer */}
      <footer className="bg-background border-t border-border py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="text-sm text-muted-foreground">
            &copy; {new Date().getFullYear()} TENsNAP・Omni. All rights reserved.
          </div>
          <div className="flex gap-8 text-sm text-muted-foreground">
            <Link href="/legal/terms" className="hover:text-foreground transition-colors">
              利用規約
            </Link>
            <Link href="/legal/privacy" className="hover:text-foreground transition-colors">
              プライバシーポリシー
            </Link>
            <Link href="/legal/privacy#contact" className="hover:text-foreground transition-colors">
              お問い合わせ
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
