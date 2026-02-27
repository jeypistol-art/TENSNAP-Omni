import { getServerSession } from "next-auth";
import { authOptions } from "./api/auth/[...nextauth]/route";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  ArrowRight,
  Camera,
  CheckCircle2,
  Lightbulb,
  LineChart,
  Lock,
  Send,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

function hasForceLogoutError(session: unknown): boolean {
  if (!session || typeof session !== "object") return false;
  const maybe = session as { error?: unknown };
  return maybe.error === "ForceLogout";
}

export const metadata = {
  alternates: {
    canonical: "https://family.10snap.win",
  },
  keywords: ["TENsNAP", "家庭学習", "教育AI", "答案分析", "弱点分析", "学習サポート"],
};

export default async function Home() {
  const session = await getServerSession(authOptions);

  if (session && !hasForceLogoutError(session)) {
    redirect("/dashboard");
  }

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
