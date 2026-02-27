import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { headers } from "next/headers";
import { authOptions } from "./api/auth/[...nextauth]/route";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  ArrowRight,
  Camera,
  CheckCircle,
  CheckCircle2,
  Lightbulb,
  LineChart,
  Lock,
  Smartphone,
  Send,
  ShieldCheck,
  Sparkles,
  FileText,
  TrendingUp,
  Layout,
  Users,
  Zap,
} from "lucide-react";

const DEFAULT_FAMILY_HOST = "family.10snap.win";

function normalizeHost(raw: string | null): string {
  if (!raw) return "";
  return raw.toLowerCase().split(",")[0].trim().replace(/:\\d+$/, "");
}

function getFamilyHosts(): Set<string> {
  const configured = process.env.FAMILY_HOSTS || process.env.FAMILY_HOST || DEFAULT_FAMILY_HOST;
  return new Set(
    configured
      .split(",")
      .map((host) => normalizeHost(host))
      .filter(Boolean)
  );
}

async function isFamilyHostRequest(): Promise<boolean> {
  const h = await headers();
  const host = normalizeHost(h.get("x-forwarded-host") || h.get("host"));
  return getFamilyHosts().has(host);
}

function hasForceLogoutError(session: unknown): boolean {
  if (!session || typeof session !== "object") return false;
  const maybe = session as { error?: unknown };
  return maybe.error === "ForceLogout";
}

export async function generateMetadata(): Promise<Metadata> {
  const isFamilyHost = await isFamilyHostRequest();

  if (isFamilyHost) {
    return {
      alternates: { canonical: "https://family.10snap.win" },
      keywords: ["TENsNAP", "家庭学習", "教育AI", "答案分析", "弱点分析", "学習サポート"],
    };
  }

  return {
    alternates: { canonical: "https://10snap.win" },
    keywords: ["TENsNAP", "教育AI", "塾運営効率化", "答案分析", "成績管理", "指導改善"],
  };
}

export default async function Home() {
  const session = await getServerSession(authOptions);

  if (session && !hasForceLogoutError(session)) {
    redirect("/dashboard");
  }

  const isFamilyHost = await isFamilyHostRequest();
  return isFamilyHost ? <FamilyLanding /> : <SchoolLanding />;
}

function SchoolLanding() {
  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground overflow-x-hidden">
      <nav className="sticky top-0 w-full z-50 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex-shrink-0 flex items-center">
              <span className="text-2xl font-bold text-mizuho">TENsNAP・Omni</span>
            </div>
            <div className="flex items-center space-x-4">
              <Link
                href="/login"
                className="text-sm font-medium text-muted-foreground hover:text-mizuho transition-colors"
              >
                ログイン
              </Link>
              <Link
                href="/login"
                className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-mizuho hover:bg-blue-800 transition-colors shadow-sm"
              >
                無料で始める
              </Link>
            </div>
          </div>
        </div>
      </nav>

      <main>
        <section className="relative pt-24 pb-20 lg:pt-40 lg:pb-28 overflow-hidden">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
            <div className="text-center max-w-4xl mx-auto">
              <h1 className="text-4xl sm:text-5xl lg:text-7xl font-extrabold tracking-tight text-foreground mb-8 text-balance">
                <span className="block text-mizuho">学習理解度を可視化</span>
                <span className="block mt-2">指導を改善する分析支援システム</span>
              </h1>
              <p className="mt-4 text-xl sm:text-2xl text-muted-foreground max-w-2xl mx-auto mb-10 text-balance">
                採点後の答案用紙をスキャンするだけ。<br className="hidden sm:block" />
                成長率、弱点、次の一手が瞬時に分かる。
              </p>
              <div className="flex flex-col sm:flex-row justify-center gap-4">
                <Link
                  href="/login"
                  className="inline-flex items-center justify-center px-8 py-4 text-lg font-bold rounded-full text-white bg-mizuho hover:bg-blue-800 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-1"
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

          <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10 opacity-30 pointer-events-none">
            <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-200 rounded-full mix-blend-multiply filter blur-3xl"></div>
            <div className="absolute top-1/3 right-1/4 w-96 h-96 bg-cyan-200 rounded-full mix-blend-multiply filter blur-3xl"></div>
            <div className="absolute bottom-1/4 left-1/3 w-96 h-96 bg-indigo-200 rounded-full mix-blend-multiply filter blur-3xl"></div>
          </div>
        </section>

        <section className="py-24 bg-muted/30">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-base font-semibold text-mizuho tracking-wide uppercase">Features</h2>
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
                  color: "bg-blue-500",
                },
                {
                  icon: <TrendingUp className="h-8 w-8 text-white" />,
                  title: "成長トレンド分析",
                  desc: "過去の分析結果を一覧表示し、人目で成績の動きが分かるグラフを生成。生徒の「伸び」を逃しません。",
                  color: "bg-indigo-500",
                },
                {
                  icon: <Layout className="h-8 w-8 text-white" />,
                  title: "自動資料作成",
                  desc: "データをまとめて資料作りに費やしていた数時間を、わずか数分に短縮。PDFとして即保存・印刷可能です。",
                  color: "bg-cyan-500",
                },
              ].map((feature, idx) => (
                <div key={idx} className="bg-card rounded-2xl p-8 shadow-sm border border-border hover:shadow-md transition-shadow">
                  <div className={`inline-flex items-center justify-center p-3 rounded-xl ${feature.color} shadow-lg mb-6`}>
                    {feature.icon}
                  </div>
                  <h3 className="text-xl font-bold text-foreground mb-3">{feature.title}</h3>
                  <p className="text-muted-foreground leading-relaxed">{feature.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="py-24 overflow-hidden">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="lg:grid lg:grid-cols-2 lg:gap-16 items-center">
              <div className="mb-12 lg:mb-0">
                <div className="inline-flex items-center px-4 py-2 rounded-full bg-blue-100 text-mizuho font-semibold text-sm mb-6">
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
                    "ワンクリックで印刷用PDF生成",
                  ].map((item, i) => (
                    <li key={i} className="flex items-start">
                      <CheckCircle className="h-6 w-6 text-green-500 mr-3 flex-shrink-0" />
                      <span className="text-foreground font-medium">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="relative">
                <div className="aspect-[4/3] rounded-2xl bg-gradient-to-br from-gray-100 to-gray-200 border border-border shadow-2xl flex items-center justify-center relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-t from-background/90 to-transparent"></div>
                  <div className="relative z-10 text-center p-8">
                    <TrendingUp className="h-16 w-16 text-mizuho mx-auto mb-4" />
                    <p className="text-xl font-bold">成長トレンドを見える化</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="py-24 bg-mizuho text-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="lg:grid lg:grid-cols-2 lg:gap-16 items-center">
              <div className="order-2 lg:order-1 relative">
                <div className="mx-auto w-64 h-[500px] bg-gray-900 rounded-[3rem] border-[8px] border-gray-800 shadow-2xl overflow-hidden relative">
                  <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-32 h-6 bg-gray-800 rounded-b-2xl"></div>
                  <div className="w-full h-full bg-white flex items-center justify-center overflow-hidden">
                    <span className="text-gray-400 text-sm">スマホ撮影イメージ</span>
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

        <section className="py-24 bg-background">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-2xl font-bold text-foreground mb-12">
              教育現場だからこそ、<br className="sm:hidden" />妥協しない安全性と使いやすさ
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-left">
              <div className="bg-muted/30 p-8 rounded-2xl border border-border">
                <div className="flex items-center mb-4">
                  <Lock className="h-6 w-6 text-mizuho mr-3" />
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
                  <Users className="h-6 w-6 text-mizuho mr-3" />
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
              <div className="absolute left-4 md:left-1/2 top-0 bottom-0 w-0.5 bg-border transform md:-translate-x-1/2"></div>
              <div className="space-y-12 relative">
                <div className="md:flex items-center justify-between group">
                  <div className="md:w-[45%] mb-4 md:mb-0 md:text-right order-1">
                    <h3 className="text-xl font-bold bg-white border-2 border-mizuho text-mizuho inline-block px-4 py-1 rounded-full mb-2">STEP 01</h3>
                    <h4 className="text-lg font-bold">2週間の無料トライアル</h4>
                    <p className="text-muted-foreground mt-2">
                      まずは全ての機能を無料でお試しください。<br />
                      クレジットカードも個人情報も登録不要。<br />
                      煩わしい営業連絡も一切ありません。
                    </p>
                  </div>
                  <div className="absolute left-4 md:left-1/2 w-4 h-4 bg-mizuho rounded-full border-4 border-white md:-translate-x-1/2 transform -translate-x-1/2 mt-1.5 md:mt-0 z-10"></div>
                  <div className="md:w-[45%] pl-12 md:pl-0 order-2"></div>
                </div>

                <div className="md:flex items-center justify-between group">
                  <div className="md:w-[45%] mb-4 md:mb-0 order-1 md:order-2">
                    <div className="pl-12 md:pl-0">
                      <h3 className="text-xl font-bold bg-white border-2 border-indigo-500 text-indigo-500 inline-block px-4 py-1 rounded-full mb-2">STEP 02</h3>
                      <h4 className="text-lg font-bold">トライアル期間中</h4>
                      <p className="text-muted-foreground mt-2">
                        機能に満足いただければ、期間中でもいつでも本契約へ移行可能です。<br />
                        <span className="font-bold text-red-500">7日以内の本契約で初期費用が50%OFF</span>になる特典もご用意しています。
                      </p>
                    </div>
                  </div>
                  <div className="absolute left-4 md:left-1/2 w-4 h-4 bg-indigo-500 rounded-full border-4 border-white md:-translate-x-1/2 transform -translate-x-1/2 mt-1.5 md:mt-0 z-10"></div>
                  <div className="md:w-[45%] order-2 md:order-1"></div>
                </div>

                <div className="md:flex items-center justify-between group">
                  <div className="md:w-[45%] mb-4 md:mb-0 md:text-right order-1">
                    <h3 className="text-xl font-bold bg-white border-2 border-gray-400 text-gray-500 inline-block px-4 py-1 rounded-full mb-2">STEP 03</h3>
                    <h4 className="text-lg font-bold">トライアル満了後</h4>
                    <p className="text-muted-foreground mt-2">
                      期間が終了すると自動的に利用停止となります。<br />
                      勝手に課金されることはありません。<br />
                      本契約を行うことで、データを引き継いで利用を再開できます。
                    </p>
                  </div>
                  <div className="absolute left-4 md:left-1/2 w-4 h-4 bg-gray-400 rounded-full border-4 border-white md:-translate-x-1/2 transform -translate-x-1/2 mt-1.5 md:mt-0 z-10"></div>
                  <div className="md:w-[45%] pl-12 md:pl-0 order-2"></div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="py-24 bg-background">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-3xl font-extrabold text-foreground sm:text-4xl mb-6">
              料金プラン
            </h2>
            <p className="text-xl text-muted-foreground mb-12">
              シンプルで透明性の高い料金体系。<br />
              生徒数が増えても料金は変わりません。
            </p>

            <div className="bg-white rounded-2xl shadow-xl border border-mizuho/20 p-8 md:p-12 relative overflow-hidden">
              <div className="absolute top-0 right-0 bg-red-500 text-white text-xs font-bold px-8 py-2 transform rotate-45 translate-x-8 translate-y-4 shadow-md">
                Early Bird Offer
              </div>

              <div className="grid md:grid-cols-2 gap-8 items-center divide-y md:divide-y-0 md:divide-x divide-gray-200">
                <div className="pb-8 md:pb-0 md:pr-8">
                  <h3 className="text-lg font-semibold text-muted-foreground uppercase tracking-wide mb-2">初期費用</h3>
                  <div className="flex flex-col items-center justify-center">
                    <span className="text-gray-400 line-through text-lg">¥50,000</span>
                    <div className="flex items-end gap-2">
                      <span className="text-4xl font-bold text-foreground">¥25,000</span>
                      <span className="text-sm text-muted-foreground mb-1">（税込）</span>
                    </div>
                    <p className="text-red-500 text-sm font-bold mt-2 bg-red-50 px-3 py-1 rounded-full">
                      登録後7日以内の契約で50%OFF
                    </p>
                    <p className="text-xs text-muted-foreground mt-2">通常価格: ¥50,000</p>
                  </div>
                </div>
                <div className="pt-8 md:pt-0 md:pl-8">
                  <h3 className="text-lg font-semibold text-muted-foreground uppercase tracking-wide mb-2">月額利用料</h3>
                  <div className="flex items-end justify-center gap-2">
                    <span className="text-5xl font-extrabold text-mizuho">¥9,800</span>
                    <span className="text-sm text-muted-foreground mb-2">（税込）/ 月</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-4">
                    1アカウントにつき2デバイスまで<br />
                    生徒数無制限
                  </p>
                </div>
              </div>

              <div className="mt-8 pt-8 border-t border-gray-100 text-sm text-muted-foreground">
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
            <Link
              href="/login"
              className="inline-flex items-center justify-center px-8 py-4 text-lg font-bold rounded-lg text-white bg-mizuho hover:bg-blue-800 transition-colors shadow-md"
            >
              無料でアカウント作成
            </Link>
          </div>
        </section>
      </main>

      <footer className="bg-background border-t border-border py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center gap-6 text-sm text-muted-foreground">
          <div>&copy; {new Date().getFullYear()} TENsNAP・Omni. All rights reserved.</div>
          <div className="flex gap-8">
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

function FamilyLanding() {
  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      <nav className="sticky top-0 z-50 border-b border-border bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
          <p className="text-lg font-bold text-mizuho">家庭用TENsNAP</p>
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              ログイン
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center justify-center rounded-full bg-mizuho px-4 py-2 text-sm font-semibold text-white hover:bg-blue-900 transition-colors"
            >
              無料で始める
            </Link>
          </div>
        </div>
      </nav>

      <main>
        <section className="relative overflow-hidden border-b border-border bg-[radial-gradient(circle_at_top_right,_#dbeafe_0%,_transparent_45%),radial-gradient(circle_at_bottom_left,_#e0f2fe_0%,_transparent_40%)]">
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-20 sm:px-6 lg:py-28">
            <div className="max-w-4xl">
              <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-blue-200 bg-white/80 px-4 py-1 text-sm font-medium text-mizuho">
                <Sparkles className="h-4 w-4" />
                お子様専用 学習分析アシスタント
              </p>
              <h1 className="text-4xl font-black leading-tight sm:text-5xl lg:text-6xl">
                「点数」で終わらせない。<br />
                AIが導く、お子様専用の成長ロードマップ。
              </h1>
              <p className="mt-6 max-w-3xl text-lg text-muted-foreground sm:text-xl">
                テストやプリントを撮って送るだけ。AIが弱点と「次の一手」を自動抽出。
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
                <Link
                  href="/login"
                  className="inline-flex items-center justify-center rounded-full bg-mizuho px-7 py-4 text-base font-bold text-white shadow-lg shadow-blue-200/70 transition hover:-translate-y-0.5 hover:bg-blue-900"
                >
                  まずは無料でお試し
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
                <p className="text-sm text-muted-foreground">2週間フル機能を体験（自動更新なしで安心）</p>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
          <h2 className="text-2xl font-bold sm:text-3xl">解決できる3つのこと</h2>
          <div className="mt-8 grid gap-5 md:grid-cols-3">
            {[
              {
                icon: <LineChart className="h-6 w-6 text-mizuho" />,
                title: "【分析】採点ではなく「成長率」と「弱点」を可視化",
                description:
                  "単なる〇×ではなく、どの単元が苦手で、前回からどこが成長したかをAIが抽出します。",
              },
              {
                icon: <Lightbulb className="h-6 w-6 text-mizuho" />,
                title: "【戦略】「次の一手」をAIがアドバイス",
                description:
                  "「次に何を覚えるべきか」を具体的に提示。迷う時間を勉強の時間に変えます。",
              },
              {
                icon: <CheckCircle2 className="h-6 w-6 text-mizuho" />,
                title: "【継続】モチベーションを科学する",
                description:
                  "自分の成長を数値で知ることで、学習への意欲を引き出し、自走する力を育みます。",
              },
            ].map((feature) => (
              <article key={feature.title} className="rounded-2xl border border-border bg-card p-6 shadow-sm">
                <div className="mb-4 inline-flex rounded-xl bg-blue-50 p-2">{feature.icon}</div>
                <h3 className="text-lg font-bold leading-snug">{feature.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{feature.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="border-y border-border bg-slate-50/70">
          <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
            <h2 className="text-2xl font-bold sm:text-3xl">使い方は驚くほどカンタン</h2>
            <div className="mt-8 grid gap-5 md:grid-cols-3">
              {[
                {
                  icon: <Camera className="h-5 w-5 text-mizuho" />,
                  title: "撮る",
                  detail: "問題用紙と解答用紙をスマホで撮影。",
                },
                {
                  icon: <Send className="h-5 w-5 text-mizuho" />,
                  title: "送る",
                  detail: "画像をそのままアップロード（一体型なら1枚でOK）。",
                },
                {
                  icon: <Sparkles className="h-5 w-5 text-mizuho" />,
                  title: "知る",
                  detail: "AIが即座に分析結果とアドバイスを表示。",
                },
              ].map((step) => (
                <article key={step.title} className="rounded-2xl border border-border bg-white p-6">
                  <p className="mb-3 inline-flex items-center gap-2 text-sm font-semibold text-mizuho">
                    {step.icon}
                    STEP
                  </p>
                  <h3 className="text-xl font-bold">{step.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{step.detail}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
          <h2 className="text-2xl font-bold sm:text-3xl">料金・ご利用プラン</h2>
          <div className="mt-8 overflow-hidden rounded-2xl border border-border">
            <table className="w-full border-collapse text-sm sm:text-base">
              <tbody>
                {[
                  ["月額料金", "2,980円（税込）"],
                  ["対象", "1アカウントにつきお子様1名様まで"],
                  ["お試し期間", "2週間無料（期間終了後に自動課金されることはありません）"],
                  ["ログイン方法", "メールアドレス または Googleアカウント"],
                ].map(([label, value]) => (
                  <tr key={label} className="border-b border-border last:border-b-0">
                    <th className="w-1/3 bg-slate-50 px-4 py-4 text-left font-semibold">{label}</th>
                    <td className="px-4 py-4">{value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            複数のお子様でご利用の場合：お子様ごとに個別のメールアドレス、またはGoogleアカウントをご用意ください。
          </p>
        </section>

        <section className="border-y border-border bg-slate-50/70">
          <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
            <h2 className="text-2xl font-bold sm:text-3xl">安全・信頼のセキュリティー</h2>
            <div className="mt-8 grid gap-5 md:grid-cols-2">
              <article className="rounded-2xl border border-border bg-white p-6">
                <p className="mb-3 inline-flex items-center gap-2 text-mizuho">
                  <ShieldCheck className="h-5 w-5" />
                  鉄壁のガード
                </p>
                <p className="text-sm text-muted-foreground">安全性の高いクラウドサーバーを採用。</p>
              </article>
              <article className="rounded-2xl border border-border bg-white p-6">
                <p className="mb-3 inline-flex items-center gap-2 text-mizuho">
                  <Lock className="h-5 w-5" />
                  高度な暗号化
                </p>
                <p className="text-sm text-muted-foreground">
                  全ての通信を強力に暗号化し、大切なお子様の個人情報を漏洩から守ります。
                </p>
              </article>
            </div>
          </div>
        </section>

        <section className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
          <h2 className="text-2xl font-bold sm:text-3xl">よくあるご質問 (FAQ)</h2>
          <div className="mt-8 space-y-4">
            <article className="rounded-2xl border border-border bg-card p-6">
              <p className="font-semibold">Q: 2週間経ったら勝手にお金がかかりますか？</p>
              <p className="mt-2 text-sm text-muted-foreground">
                A: いいえ、ご安心ください。お試し期間終了後に自動で入会（課金）されることはありません。
              </p>
            </article>
            <article className="rounded-2xl border border-border bg-card p-6">
              <p className="font-semibold">Q: 問題と回答が1枚になっているテストでも大丈夫？</p>
              <p className="mt-2 text-sm text-muted-foreground">
                A: はい、その画像1枚だけでAIがしっかり分析いたします。
              </p>
            </article>
          </div>
        </section>

        <section className="border-t border-border bg-slate-100/80">
          <div className="mx-auto flex w-full max-w-6xl flex-col items-center px-4 py-16 text-center sm:px-6">
            <h2 className="text-3xl font-black sm:text-4xl">
              まずは2週間、<br className="sm:hidden" />
              家庭用TENsNAPを体験
            </h2>
            <p className="mt-4 text-muted-foreground">自動更新なし。必要な時に、安心して始められます。</p>
            <Link
              href="/login"
              className="mt-7 inline-flex items-center justify-center rounded-full bg-mizuho px-8 py-4 text-base font-bold text-white transition hover:bg-blue-900"
            >
              まずは無料でお試し
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-border py-8">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-4 px-4 text-sm text-muted-foreground sm:flex-row sm:px-6">
          <p>&copy; {new Date().getFullYear()} TENsNAP</p>
          <div className="flex items-center gap-5">
            <Link href="/legal/terms" className="hover:text-foreground">
              利用規約
            </Link>
            <Link href="/legal/privacy" className="hover:text-foreground">
              プライバシーポリシー
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
