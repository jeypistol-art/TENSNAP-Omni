import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { headers } from "next/headers";
import { authOptions } from "./api/auth/[...nextauth]/route";
import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
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

function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

export async function generateMetadata(): Promise<Metadata> {
  const isFamilyHost = await isFamilyHostRequest();

  if (isFamilyHost) {
    return {
      title: "TENsNAP家庭用 | AIが「つまずきの根っこ」を特定。小中高12年間の学習ログ",
      description:
        "月額2,980円で、わが家専属のAI家庭教師を。テストや問題集を撮るだけで、AIが苦手単元を自動特定。算数から高校数学まで12年間の成長を可視化します。初期費用0円、塾クオリティの分析エンジンで、お子様の「わからない」を解決へ。",
      alternates: { canonical: "https://family.10snap.win" },
      robots: {
        index: true,
        follow: true,
        googleBot: {
          index: true,
          follow: true,
          "max-snippet": -1,
          "max-image-preview": "large",
          "max-video-preview": -1,
        },
      },
      keywords: [
        "子供 AI 勉強",
        "AI 弱点分析 アプリ",
        "AI つまずき特定",
        "AI 苦手単元 診断",
        "学習ログ 可視化",
        "算数 つまずき 原因",
        "中学 英語 わからない どこから",
        "高校数学 苦手克服",
        "AI 学習進捗 可視化 ツール",
      ],
      openGraph: {
        type: "website",
        url: "https://family.10snap.win",
        siteName: "TENsNAP家庭用",
        title: "TENsNAP家庭用 | AI学習分析で、12年間の成長を一生モノの資産に。",
        description: "「どこがわからないか、わからない」をAIが解決。2,980円で始める、プロ仕様の学習分析。",
        locale: "ja_JP",
        images: [
          {
            url: "https://family.10snap.win/images/og-family.jpg",
            width: 1200,
            height: 630,
            alt: "テストを撮るだけ。AIがつまずきを言葉にする。",
          },
        ],
      },
      twitter: {
        card: "summary_large_image",
        title: "TENsNAP家庭用 | AIがつまずきを言葉にする",
        description: "算数から高校数学まで。12年間の学習ログをAIで見える化。",
        images: ["https://family.10snap.win/images/og-family.jpg"],
      },
      category: "education",
    };
  }

  return {
    title: "TENsNAP・Omni | 小1から高3まで。12年間のつまずきをAIで可視化",
    description:
      "塾向けAI学習分析プラットフォーム。答案を撮るだけで、弱点分析・成長推移・面談用PDFを自動生成。算数/数学・英語/外国語・国語・理科/科学/理数・社会/地理/歴史の主要5教科を横断し、指導品質と運営効率を同時に高めます。",
    alternates: { canonical: "https://10snap.win" },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-snippet": -1,
        "max-image-preview": "large",
        "max-video-preview": -1,
      },
    },
    keywords: [
      "塾 AI",
      "塾運営効率化",
      "答案分析",
      "AI 弱点分析",
      "AI 学習進捗 可視化",
      "保護者面談 PDF",
      "個別指導 学習管理",
      "算数 数学 つまずき",
      "中学 高校 学習データ",
    ],
    openGraph: {
      type: "website",
      url: "https://10snap.win",
      siteName: "TENsNAP・Omni",
      title: "TENsNAP・Omni | 小1から高3まで。12年間のつまずきをAIで可視化",
      description: "塾の指導品質を上げる。答案撮影だけで弱点分析・成長グラフ・面談資料を自動生成。",
      locale: "ja_JP",
      images: [
        {
          url: "https://10snap.win/images/og-image.jpg",
          width: 1200,
          height: 630,
          alt: "TENsNAP・Omni - 塾向けAI学習分析",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: "TENsNAP・Omni | 塾向けAI学習分析",
      description: "小中高12年間のつまずきをつなぎ、指導品質を向上。",
      images: ["https://10snap.win/images/og-image.jpg"],
    },
    category: "education",
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
  const subjectLabels = ["算数/数学", "英語/外国語", "国語", "理科/科学/理数", "社会/地理/歴史"];
  const schoolStructuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        name: "TENsNAP・Omni",
        url: "https://10snap.win",
        inLanguage: "ja",
      },
      {
        "@type": "SoftwareApplication",
        name: "TENsNAP・Omni",
        applicationCategory: "EducationalApplication",
        operatingSystem: "Web",
        url: "https://10snap.win",
        description:
          "小中高12年間の学習ログを可視化する、塾向けAI学習分析プラットフォーム。答案撮影だけで弱点分析・成長推移・面談用PDFを自動生成。",
        offers: {
          "@type": "Offer",
          priceCurrency: "JPY",
          price: "9800",
        },
      },
      {
        "@type": "Organization",
        name: "TENsNAP・Omni",
        url: "https://10snap.win",
      },
    ],
  };
  const schoolFeatures = [
    {
      icon: <LineChart className="h-6 w-6 text-blue-700" />,
      title: "データの資産化",
      desc: "生徒名を登録するだけで、学習可視化ツールとしてデータベースを作成。小1から高3までのつまずきを一本の線でつなぎます。",
    },
    {
      icon: <FileText className="h-6 w-6 text-blue-700" />,
      title: "面談の武器も一発",
      desc: "生成される期間成長レポートは、そのまま印刷して保護者への面談資料に使えるクオリティ。面談に必要な資料作成の時間を97.5％削減！",
    },
    {
      icon: <Layout className="h-6 w-6 text-blue-700" />,
      title: "運用手間を最小化",
      desc: "不必要な機能を隠した迷わないUI。撮影して送るだけでAI弱点分析アプリの価値を現場に即導入でき、事務負担を削減します。",
    },
  ];

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
        <JsonLd data={schoolStructuredData} />
        <section className="relative pt-24 pb-14 lg:pt-32 lg:pb-18 overflow-hidden border-b border-border">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
            <div className="text-center max-w-4xl mx-auto">
              <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-4 py-1.5 text-sm font-semibold text-blue-700">
                <Sparkles className="h-4 w-4" />
                小1から高3まで。12年間の学習ログを一元管理
              </p>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-foreground mb-8 text-balance leading-tight">
                <span className="block text-mizuho">小1から高3まで。</span>
                <span className="block mt-4 sm:mt-6">12年間のつまずきを、AIが一本の線でつなぐ。</span>
              </h1>
              <p className="mt-4 text-lg sm:text-xl text-muted-foreground max-w-3xl mx-auto mb-10 text-balance leading-relaxed">
                小・中・高の全学年、主要5教科を完全カバー。<br />
                個別指導の学習管理をこれ一端に。<br />
                AIつまずき特定・AI苦手単元診断・AI学習進捗可視化を、答案スキャンだけで実現します。
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
            </div>
          </div>

          <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10 opacity-30 pointer-events-none">
            <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-200 rounded-full mix-blend-multiply filter blur-3xl"></div>
            <div className="absolute top-1/3 right-1/4 w-96 h-96 bg-cyan-200 rounded-full mix-blend-multiply filter blur-3xl"></div>
            <div className="absolute bottom-1/4 left-1/3 w-96 h-96 bg-indigo-200 rounded-full mix-blend-multiply filter blur-3xl"></div>
          </div>
        </section>

        <section className="py-10 border-b border-border bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <p className="text-xs uppercase tracking-[0.2em] text-gray-500 font-semibold mb-3">対応科目</p>
            <div className="flex flex-wrap gap-2">
              {subjectLabels.map((subject) => (
                <span
                  key={subject}
                  className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-800"
                >
                  {subject}
                </span>
              ))}
            </div>
          </div>
        </section>

        <section className="py-24 bg-muted/30">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-base font-semibold text-mizuho tracking-wide uppercase">B2B Value</h2>
              <p className="mt-2 text-3xl font-extrabold text-foreground sm:text-4xl">
                指導効率と保護者説得力を同時に強化
              </p>
              <p className="mt-4 max-w-2xl text-xl text-muted-foreground mx-auto">
                「勉強してるのに成績が上がらない原因」を、現場感覚ではなくデータで示せる状態を作ります。
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
              {schoolFeatures.map((feature, idx) => (
                <div key={idx} className="bg-card rounded-2xl p-8 shadow-sm border border-border hover:shadow-md transition-shadow">
                  <div className="inline-flex items-center justify-center rounded-xl bg-blue-100 p-3 mb-6">
                    {feature.icon}
                  </div>
                  <h3 className="text-xl font-bold text-foreground mb-3">{feature.title}</h3>
                  <p className="text-muted-foreground leading-relaxed">{feature.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="py-24 overflow-hidden bg-white border-y border-border">
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
                  「算数 つまずき どこから」「中学 英語 わからなくなった どこから」といった悩みに、
                  根拠ある回答を即提示。塾内共有・保護者面談・次回授業設計まで一本化できます。
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
                <div className="rounded-2xl border border-border bg-white shadow-2xl p-6">
                  <p className="text-xs font-bold text-blue-700 mb-4 tracking-wider">算数から数学へ 可視化デモ</p>
                  <div className="space-y-3">
                    <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
                      <p className="text-xs text-gray-600">小5 / 算数</p>
                      <p className="font-bold text-gray-800">分数の計算</p>
                    </div>
                    <div className="flex justify-center">
                      <ArrowRight className="h-5 w-5 text-gray-400 rotate-90" />
                    </div>
                    <div className="rounded-xl border border-amber-100 bg-amber-50 p-4">
                      <p className="text-xs text-gray-600">中1 / 数学</p>
                      <p className="font-bold text-gray-800">方程式に注意アラート</p>
                    </div>
                    <div className="flex justify-center">
                      <ArrowRight className="h-5 w-5 text-gray-400 rotate-90" />
                    </div>
                    <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-4">
                      <p className="text-xs text-gray-600">高校 / 理系科目</p>
                      <p className="font-bold text-gray-800">基礎の抜けを早期補修</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="py-24 bg-muted/30 border-b border-border">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-3xl font-extrabold text-foreground sm:text-4xl mb-4">
                期間成長レポートの例
              </h2>
              <p className="text-xl text-muted-foreground">
                各科目の実際の出力レポート（PDF）をご覧いただけます。
              </p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6">
              {[
                { name: "算数/数学", file: "sugaku_result.pdf", color: "text-blue-600", bg: "bg-blue-50", border: "border-blue-200" },
                { name: "英語/外国語", file: "eigo_result.pdf", color: "text-rose-600", bg: "bg-rose-50", border: "border-rose-200" },
                { name: "国語", file: "kokugo_result.pdf", color: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-200" },
                { name: "理科/科学/理数", file: "rika_result.pdf", color: "text-amber-600", bg: "bg-amber-50", border: "border-amber-200" },
                { name: "社会/地理/歴史", file: "syakai_result.pdf", color: "text-purple-600", bg: "bg-purple-50", border: "border-purple-200" },
              ].map((subject, i) => (
                <a
                  key={i}
                  href={`/tensnap_result/${subject.file}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`flex flex-col items-center justify-center p-6 rounded-2xl border ${subject.border} ${subject.bg} hover:shadow-lg transition-all hover:-translate-y-1 bg-white`}
                >
                  <FileText className={`h-8 w-8 mb-3 ${subject.color}`} />
                  <span className={`font-bold ${subject.color} text-center`}>{subject.name}</span>
                </a>
              ))}
            </div>
          </div>
        </section>

        <section className="py-24 bg-background border-b border-border">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-3xl font-extrabold text-foreground sm:text-4xl mb-12">
              直感的な操作で、即座に分析
            </h2>
            <div className="w-full max-w-4xl mx-auto rounded-[2rem] overflow-hidden shadow-2xl border-[6px] border-white relative bg-slate-100">
              <div className="aspect-video relative w-full h-full">
                <iframe
                  className="absolute top-0 left-0 w-full h-full"
                  src="https://www.youtube.com/embed/n85xb4WF7QQ?si=FPYVnYe-ZGX9L1i0&rel=0&modestbranding=1"
                  title="使い方動画 | TENsNAP・Omni"
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  referrerPolicy="strict-origin-when-cross-origin"
                  allowFullScreen>
                </iframe>
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
                  <div className="w-full h-full bg-white relative overflow-hidden">
                    <Image
                      src="/images/school-phone-demo.png"
                      alt="TENsNAP・Omniのスマホ画面イメージ"
                      fill
                      className="object-cover object-top"
                      sizes="256px"
                      priority
                    />
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

        <section className="py-16 bg-[#faf9f6]">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="bg-white rounded-[2rem] border-2 border-orange-100 shadow-xl overflow-hidden relative group">
              <div className="absolute top-0 left-0 w-2 h-full bg-gradient-to-b from-orange-300 to-rose-300"></div>
              <div className="p-8 sm:p-12 md:flex items-center justify-between gap-8 relative z-10">
                <div className="mb-8 md:mb-0 md:w-3/5">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-100 text-orange-700 text-xs font-bold tracking-wider mb-4">
                    <Sparkles className="h-4 w-4" />
                    ご家庭での学習にも
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-800 mb-4 leading-snug">
                    塾での指導を、<br className="hidden sm:block" />
                    家庭での『復習の質』に変える。
                  </h2>
                  <p className="text-slate-600 mb-0 leading-relaxed">
                    先生が見ているAI分析データを、ご家庭での自習にも。<br />
                    保護者様と連携し、お子様の「わからない」をなくす<br className="hidden sm:block" />
                    家庭用プラン（1名様限定）もご用意しています。
                  </p>
                </div>
                <div className="md:w-2/5 text-center md:text-right shrink-0">
                  <Link
                    href="https://family.10snap.win/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex flex-col items-center justify-center w-full px-6 py-4 rounded-2xl bg-orange-50 hover:bg-orange-100 text-orange-600 font-bold border-2 border-orange-200 transition-all shadow-sm hover:shadow-md group-hover:-translate-y-1"
                  >
                    <span className="flex items-center gap-2 mb-1">
                      家庭用プランの詳細を見る
                      <ArrowRight className="h-5 w-5" />
                    </span>
                    <span className="text-xs font-normal opacity-80">family.10snap.win</span>
                  </Link>
                </div>
              </div>
              <div className="absolute bottom-0 right-0 w-64 h-64 bg-gradient-to-tl from-orange-100/50 to-transparent rounded-tl-[100px] -z-10 pointer-events-none"></div>
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
              AI弱点分析アプリとしての即効性と、12年間の学習地図としての長期価値を両立。<br />
              まずは無料トライアルで運用負荷の軽さを体感してください。
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
  const subjectLabels = ["算数/数学", "英語/外国語", "国語", "理科/科学/理数", "社会/地理/歴史"];
  const familyStructuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        name: "TENsNAP家庭用",
        url: "https://family.10snap.win",
        inLanguage: "ja",
      },
      {
        "@type": "SoftwareApplication",
        name: "TENsNAP家庭用",
        applicationCategory: "EducationalApplication",
        operatingSystem: "Web",
        url: "https://family.10snap.win",
        description:
          "月額2,980円で、AIが苦手単元とつまずきの根っこを特定。算数から高校数学まで12年間の学習ログを可視化する家庭向け学習分析サービス。",
        offers: {
          "@type": "Offer",
          priceCurrency: "JPY",
          price: "2980",
          availability: "https://schema.org/InStock",
        },
      },
      {
        "@type": "FAQPage",
        mainEntity: [
          {
            "@type": "Question",
            name: "2週間経ったら勝手にお金がかかりますか？",
            acceptedAnswer: {
              "@type": "Answer",
              text: "いいえ。お試し期間終了後に自動で課金されることはありません。",
            },
          },
          {
            "@type": "Question",
            name: "問題と回答が1枚になっているテストでも大丈夫？",
            acceptedAnswer: {
              "@type": "Answer",
              text: "はい。画像1枚だけでもAIが分析できます。",
            },
          },
          {
            "@type": "Question",
            name: "中学や高校に進んでもデータは使えますか？",
            acceptedAnswer: {
              "@type": "Answer",
              text: "はい。小中高をまたいで学習ログを継続利用できます。",
            },
          },
        ],
      },
    ],
  };

  return (
    <div className="min-h-screen bg-[#fffcf8] text-slate-800 font-sans selection:bg-orange-200 overflow-x-hidden relative">
      <div
        className="fixed inset-0 pointer-events-none opacity-[0.03] z-0 mix-blend-multiply"
        style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` }}
      />
      <div className="relative z-10 flex flex-col min-h-screen">

        <nav className="sticky top-0 z-50 border-b border-orange-100/50 bg-[#fffcf8]/90 backdrop-blur">
          <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
            <p className="text-lg font-bold text-orange-600 tracking-wide flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-orange-400" />
              家庭用TENsNAP
            </p>
            <div className="flex items-center gap-3">
              <Link
                href="/login"
                className="text-sm font-medium text-slate-600 hover:text-orange-600 transition-colors hidden sm:block"
              >
                ログイン
              </Link>
              <Link
                href="/login"
                className="inline-flex items-center justify-center rounded-3xl bg-orange-500 px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-orange-600 transition-all hover:scale-105"
              >
                無料で始める
              </Link>
            </div>
          </div>
        </nav>

        <main>
          <JsonLd data={familyStructuredData} />
          <section className="relative overflow-hidden border-b border-orange-100/50 bg-[#fffefc]">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_#ffedd5_0%,_transparent_45%),radial-gradient(circle_at_bottom_left,_#fefce8_0%,_transparent_40%)] opacity-70"></div>
            <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-20 sm:px-6 lg:py-28 relative z-10">
              <div className="max-w-4xl">
                <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-orange-200 bg-white px-4 py-1.5 text-sm font-bold text-orange-600 shadow-sm">
                  <Lightbulb className="h-4 w-4 text-orange-400" />
                  ご家庭専用 AI学習パートナー
                </p>
                <h1 className="text-4xl font-extrabold leading-tight sm:text-5xl lg:text-6xl tracking-tight text-slate-800">
                  「わからない」の根っこを見つける。<br />
                  <span className="text-orange-600">2,980円</span>で、わが家専属のAI家庭教師を。
                </h1>
                <p className="mt-6 max-w-3xl text-lg text-slate-600 sm:text-xl leading-relaxed">
                  算数から高校数学まで。12年間の成長をAIが見守る、ご家庭のための学習パートナー。<br />
                  AIつまずき特定・AI苦手単元診断で「勉強してるのに成績上がらない原因」を優しく見える化します。
                </p>
                <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:items-center">
                  <Link
                    href="/login"
                    className="inline-flex min-h-[3.5rem] items-center justify-center rounded-[2rem] bg-orange-500 px-8 py-4 text-lg font-bold text-white shadow-xl shadow-orange-200/80 transition-all hover:-translate-y-1 hover:bg-orange-600 hover:shadow-2xl"
                  >
                    まずは無料でお試し
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Link>
                  <p className="text-sm font-medium text-slate-500 bg-white/60 px-4 py-2 rounded-full inline-block backdrop-blur-sm shadow-sm">2週間フル機能を体験（自動更新なしで安心）</p>
                </div>
                <div className="mt-10 flex flex-wrap gap-2">
                  {subjectLabels.map((subject) => (
                    <span
                      key={subject}
                      className="inline-flex items-center rounded-full border border-orange-100 bg-white px-4 py-1.5 text-xs font-bold text-orange-700 shadow-sm"
                    >
                      {subject}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6">
            <div className="text-center mb-12">
              <h2 className="text-2xl font-extrabold sm:text-3xl text-slate-800 relative inline-block">
                ご家庭に届く「3つの安心」
                <div className="absolute -bottom-2 left-0 w-full h-3 bg-orange-100 -z-10 rounded-full"></div>
              </h2>
            </div>
            <div className="mt-8 grid gap-6 md:grid-cols-3">
              {[
                {
                  icon: <LineChart className="h-7 w-7 text-orange-500" />,
                  title: "プロの道具を、そのままご家庭に",
                  description:
                    "塾で使う分析エンジンをそのまま搭載。問題と回答を撮るだけで、苦手を自動言語化します。",
                },
                {
                  icon: <Lightbulb className="h-7 w-7 text-amber-500" />,
                  title: "12年間の「学習地図」",
                  description:
                    "小学校のつまずきが中学・高校のどこに響くかを継続可視化。進学しても努力を失いません。",
                },
                {
                  icon: <CheckCircle2 className="h-7 w-7 text-emerald-500" />,
                  title: "迷わない最小限UI",
                  description:
                    "親が「勉強しなさい」と言わなくても、データを見るだけで会話が進む。スマホで簡単記録。",
                },
              ].map((feature) => (
                <article key={feature.title} className="rounded-[2rem] border-2 border-orange-50 bg-white p-8 shadow-md hover:shadow-xl transition-shadow relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-orange-50 to-transparent rounded-bl-full -z-10 opacity-50 group-hover:scale-110 transition-transform"></div>
                  <div className="mb-6 inline-flex rounded-2xl bg-orange-50 p-4 shadow-inner">{feature.icon}</div>
                  <h3 className="text-xl font-bold leading-snug mb-3 text-slate-800">{feature.title}</h3>
                  <p className="text-base leading-relaxed text-slate-600">{feature.description}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
            <div className="space-y-16 sm:space-y-24 mt-8">
              {/* Feature 1 */}
              <div className="flex flex-col md:flex-row items-center gap-10 md:gap-16">
                <div className="w-full md:w-1/2 flex justify-center">
                  <div className="relative w-full max-w-[480px] aspect-[4/3] rounded-[2rem] overflow-hidden shadow-[0_20px_50px_-12px_rgba(249,115,22,0.3)] border border-orange-100/50 bg-white">
                    <Image
                      src="/images/03_result_kokugo.png"
                      alt="AIが『つまずきの根っこ』を言語化"
                      fill
                      className="object-contain p-4"
                      sizes="(max-width: 768px) 100vw, 50vw"
                    />
                  </div>
                </div>
                <div className="w-full md:w-1/2 space-y-6">
                  <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-orange-100 text-orange-700 text-sm font-bold tracking-wider">
                    <Lightbulb className="h-4 w-4" />
                    つまずきの特定
                  </div>
                  <h3 className="text-3xl sm:text-4xl font-extrabold text-slate-800 leading-tight">
                    採点はしません。<br />
                    AIが<span className="text-orange-600">『つまずきの根っこ』</span>を言語化します。
                  </h3>
                  <p className="text-lg text-slate-600 leading-relaxed font-medium">
                    マル・バツをつけるだけではなく、「なぜ間違えたのか」「どこでつまずいているのか」をAIが優しく解説。保護者様がお子様に接する際のヒントになります。
                  </p>
                </div>
              </div>

              {/* Feature 2 */}
              <div className="flex flex-col md:flex-row-reverse items-center gap-10 md:gap-16">
                <div className="w-full md:w-1/2 flex justify-center">
                  <div className="relative w-full max-w-[540px] aspect-[5/3] rounded-[2rem] overflow-hidden shadow-[0_20px_50px_-12px_rgba(59,130,246,0.3)] border border-blue-100/50 bg-white">
                    <Image
                      src="/images/trends.png"
                      alt="12年間の学習ログを一生の資産に"
                      fill
                      className="object-contain p-4"
                      sizes="(max-width: 768px) 100vw, 50vw"
                    />
                  </div>
                </div>
                <div className="w-full md:w-1/2 space-y-6">
                  <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-100 text-blue-700 text-sm font-bold tracking-wider">
                    <LineChart className="h-4 w-4" />
                    学習推移の可視化
                  </div>
                  <h3 className="text-3xl sm:text-4xl font-extrabold text-slate-800 leading-tight">
                    算数のつまずきを、数学の得意に変える。<br />
                    12年間の学習ログを<span className="text-blue-600">一生の資産</span>に。
                  </h3>
                  <p className="text-lg text-slate-600 leading-relaxed font-medium">
                    点数の上がり下がりだけでなく、根本的な理解度の推移をグラフ化。長期間のデータを積み重ねることで、「わかった！」の瞬間を見逃さず、将来の飛躍へと繋げます。
                  </p>
                </div>
              </div>

              {/* Feature 3 */}
              <div className="flex flex-col md:flex-row items-center gap-10 md:gap-16">
                <div className="w-full md:w-1/2 flex justify-center">
                  <div className="relative w-full max-w-[480px] aspect-[4/3] rounded-[2rem] overflow-hidden shadow-[0_20px_50px_-12px_rgba(16,185,129,0.3)] border border-emerald-100/50 bg-white">
                    <Image
                      src="/images/jyuten.png"
                      alt="全部復習しなくていい。AIが『今やるべき1問』をナビゲート"
                      fill
                      className="object-contain p-4"
                      sizes="(max-width: 768px) 100vw, 50vw"
                    />
                  </div>
                </div>
                <div className="w-full md:w-1/2 space-y-6">
                  <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-100 text-emerald-700 text-sm font-bold tracking-wider">
                    <CheckCircle2 className="h-4 w-4" />
                    効率的なサポート
                  </div>
                  <h3 className="text-3xl sm:text-4xl font-extrabold text-slate-800 leading-tight">
                    全部復習しなくていい。<br />
                    AIが<span className="text-emerald-600">『今やるべき1問』</span>をナビゲート。
                  </h3>
                  <p className="text-lg text-slate-600 leading-relaxed font-medium">
                    テスト範囲から抜け漏れのあるピンポイントな単元をAIが抽出し、優先順位をつけて提示。「何を勉強すればいいか」で迷う時間をなくし、確実な定着をサポートします。
                  </p>
                </div>
              </div>
            </div>
          </section>

          <section className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 mb-12">
            <div className="text-center mb-12">
              <h2 className="text-2xl font-extrabold sm:text-3xl text-slate-800 relative inline-block">
                12年間の「学習地図」
                <div className="absolute -bottom-2 left-0 w-full h-3 bg-rose-100 -z-10 rounded-full"></div>
              </h2>
              <p className="mt-4 text-slate-600 font-medium">小・中・高と続く学びを、一本の線でつなぎます。</p>
            </div>
            <div className="relative border-l-4 border-orange-200 ml-4 sm:ml-8 space-y-12 pb-8 mt-10">
              <div className="relative pl-8 sm:pl-12">
                <div className="absolute -left-[14px] top-1 h-6 w-6 rounded-full border-4 border-[#fffcf8] bg-orange-400 shadow-sm"></div>
                <p className="text-sm font-bold text-orange-500 mb-1 tracking-wider uppercase">小学生</p>
                <h3 className="text-xl font-bold mb-2 text-slate-800">「計算」から「文章題」への壁</h3>
                <p className="text-slate-600 bg-white p-5 rounded-2xl shadow-sm border border-orange-100 leading-relaxed">
                  割合や分数のつまずきを早期に発見。「どこでわからなくなったか」をさかのぼって特定します。
                </p>
              </div>
              <div className="relative pl-8 sm:pl-12">
                <div className="absolute -left-[14px] top-1 h-6 w-6 rounded-full border-4 border-[#fffcf8] bg-rose-400 shadow-sm"></div>
                <p className="text-sm font-bold text-rose-500 mb-1 tracking-wider uppercase">中学生</p>
                <h3 className="text-xl font-bold mb-2 text-slate-800">英語・数学の「急な難化」</h3>
                <p className="text-slate-600 bg-white p-5 rounded-2xl shadow-sm border border-rose-100 leading-relaxed">
                  方程式や英文法など、抽象的な概念への戸惑いをデータでキャッチ。定期テストの点数だけでは見えない弱点を言語化します。
                </p>
              </div>
              <div className="relative pl-8 sm:pl-12">
                <div className="absolute -left-[14px] top-1 h-6 w-6 rounded-full border-4 border-[#fffcf8] bg-blue-400 shadow-sm"></div>
                <p className="text-sm font-bold text-blue-500 mb-1 tracking-wider uppercase">高校生</p>
                <h3 className="text-xl font-bold mb-2 text-slate-800">大学受験へ直結する基礎固め</h3>
                <p className="text-slate-600 bg-white p-5 rounded-2xl shadow-sm border border-blue-100 leading-relaxed">
                  膨大な学習範囲の中から、「今埋めるべき抜け漏れ」をAIが提示。効率的な自学自習を優しくサポートします。
                </p>
              </div>
            </div>
          </section>

          <section className="border-y border-orange-100/50 bg-[#fffefc] shadow-sm">
            <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6">
              <h2 className="text-2xl font-extrabold sm:text-3xl text-center mb-12 text-slate-800">使い方は驚くほどカンタン</h2>
              <div className="mt-8 grid gap-8 md:grid-cols-3">
                {[
                  {
                    icon: <Camera className="h-6 w-6 text-orange-500" />,
                    title: "撮る",
                    detail: "問題用紙と解答用紙をスマホで撮影。",
                  },
                  {
                    icon: <Send className="h-6 w-6 text-orange-500" />,
                    title: "送る",
                    detail: "画像をそのままアップロード（一体型なら1枚でOK）。",
                  },
                  {
                    icon: <Sparkles className="h-6 w-6 text-orange-500" />,
                    title: "知る",
                    detail: "AIが即座に分析結果とアドバイスを表示。",
                  },
                ].map((step) => (
                  <article key={step.title} className="rounded-[2rem] border border-orange-100 bg-white p-8 text-center shadow-lg shadow-orange-100/30 hover:-translate-y-1 transition-transform">
                    <div className="mx-auto w-16 h-16 bg-orange-50 rounded-full flex items-center justify-center mb-6 shadow-inner">
                      {step.icon}
                    </div>
                    <h3 className="text-xl font-bold mb-3 text-slate-800">{step.title}</h3>
                    <p className="text-slate-600 font-medium">{step.detail}</p>
                  </article>
                ))}
              </div>

              <div className="mt-16 w-full max-w-3xl mx-auto rounded-[2rem] overflow-hidden shadow-2xl border-[6px] border-white relative bg-slate-100">
                <div className="aspect-video relative w-full h-full">
                  <iframe
                    className="absolute top-0 left-0 w-full h-full"
                    src="https://www.youtube.com/embed/n85xb4WF7QQ?si=FPYVnYe-ZGX9L1i0&rel=0&modestbranding=1"
                    title="使い方動画 | 家庭用TENsNAP"
                    frameBorder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    referrerPolicy="strict-origin-when-cross-origin"
                    allowFullScreen>
                  </iframe>
                </div>
              </div>

              <div className="mt-16 rounded-[2rem] border-2 border-amber-100 bg-gradient-to-br from-white to-amber-50 p-8 sm:p-10 shadow-md">
                <p className="text-base font-bold text-amber-700 mb-3 flex items-center gap-2">
                  <Lightbulb className="h-5 w-5" />
                  キーワードへの答え
                </p>
                <p className="text-base leading-relaxed text-slate-700 font-medium">
                  「算数が苦手になったのは、いつから？」に対して、TENsNAPは過去データを横断分析。
                  「小4の壁」「中学英語で急にわからない」「理数系が伸びない」といった悩みを、
                  AIが根本原因ベースで整理し、親子で次に取り組むべき1ステップを優しく提案します。
                </p>
              </div>
            </div>
          </section>

          <section className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6">
            <h2 className="text-2xl font-extrabold sm:text-3xl text-slate-800">料金・ご利用プラン</h2>
            <div className="mt-8 overflow-hidden rounded-[2rem] border-2 border-orange-100 bg-white shadow-xl shadow-orange-100/30">
              <table className="w-full border-collapse text-sm sm:text-base">
                <tbody>
                  {[
                    ["月額料金", <span key="price" className="text-xl font-bold text-orange-600">2,980円<span className="text-sm font-normal text-slate-500">（税込）</span></span>],
                    ["初期費用", "0円"],
                    ["対象", "1アカウントにつきお子様1名様まで"],
                    ["お試し期間", "2週間無料（期間終了後に自動課金されることはありません）"],
                    ["ログイン方法", "メールアドレス または Googleアカウント"],
                  ].map(([label, value], idx) => (
                    <tr key={idx} className="border-b border-orange-50 last:border-b-0">
                      <th className="w-1/3 bg-orange-50/50 px-6 py-5 text-left font-bold text-slate-700">{label}</th>
                      <td className="px-6 py-5 text-slate-800 font-medium">{value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-4 text-sm text-slate-500 font-medium pl-2 border-l-2 border-orange-200">
              複数のお子様でご利用の場合：お子様ごとに個別のメールアドレス、またはGoogleアカウントをご用意ください。
            </p>
          </section>

          <section className="border-y border-orange-100/50 bg-[#fffefc] shadow-sm">
            <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6">
              <h2 className="text-2xl font-extrabold sm:text-3xl text-slate-800 mb-12 text-center">安全・信頼のセキュリティー</h2>
              <div className="grid gap-6 md:grid-cols-2 max-w-4xl mx-auto">
                <article className="rounded-[2rem] border border-orange-100 bg-white p-8 shadow-md">
                  <p className="mb-4 inline-flex items-center gap-2 text-rose-500 font-bold text-lg">
                    <ShieldCheck className="h-6 w-6" />
                    鉄壁のガード
                  </p>
                  <p className="text-slate-600 leading-relaxed font-medium">安全性の高いクラウドサーバーを採用し、大切なデータを守ります。</p>
                </article>
                <article className="rounded-[2rem] border border-orange-100 bg-white p-8 shadow-md">
                  <p className="mb-4 inline-flex items-center gap-2 text-rose-500 font-bold text-lg">
                    <Lock className="h-6 w-6" />
                    高度な暗号化
                  </p>
                  <p className="text-slate-600 leading-relaxed font-medium">
                    全ての通信を強力に暗号化し、お子様の個人情報を漏洩から守ります。
                  </p>
                </article>
              </div>
            </div>
          </section>

          <section className="mx-auto w-full max-w-4xl px-4 py-20 sm:px-6">
            <h2 className="text-2xl font-extrabold sm:text-3xl text-center text-slate-800 mb-12">よくあるご質問 (FAQ)</h2>
            <div className="space-y-6">
              {[
                { q: "2週間経ったら勝手にお金がかかりますか？", a: "いいえ、ご安心ください。お試し期間終了後に自動で入会（課金）されることはありません。" },
                { q: "問題と回答が1枚になっているテストでも大丈夫？", a: "はい、その画像1枚だけでAIがしっかり分析いたします。" },
                { q: "中学や高校に進んでもデータは使えますか？", a: "はい。小・中・高をまたいで蓄積できるため、「あとで効く」学習ログとして使い続けられます。" }
              ].map((faq, i) => (
                <article key={i} className="rounded-[2rem] border-2 border-orange-50 bg-white p-8 shadow-sm hover:shadow-md transition-shadow">
                  <p className="font-bold text-lg text-slate-800 flex items-start gap-3">
                    <span className="text-orange-500 font-black">Q.</span>
                    {faq.q}
                  </p>
                  <p className="mt-4 text-base text-slate-600 leading-relaxed flex items-start gap-3 bg-orange-50/50 p-4 rounded-xl border border-orange-100/50">
                    <span className="text-rose-400 font-black">A.</span>
                    {faq.a}
                  </p>
                </article>
              ))}
            </div>
          </section>

          <section className="py-20 bg-[#fffcf8]">
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="bg-slate-800 rounded-[2.5rem] shadow-2xl overflow-hidden relative group">
                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 mix-blend-overlay pointer-events-none"></div>
                <div className="p-8 sm:p-12 md:flex items-center justify-between gap-8 relative z-10">
                  <div className="mb-8 md:mb-0 md:w-3/5 text-white">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-700 text-blue-300 text-xs font-bold tracking-wider mb-4 border border-slate-600">
                      <ShieldCheck className="h-4 w-4" />
                      プロ仕様のエンジンをご家庭に
                    </div>
                    <h2 className="text-2xl sm:text-3xl font-extrabold mb-4 leading-snug">
                      全国の学習塾が信頼する<br className="hidden sm:block" />
                      AI分析。その『本物』をわが家へ。
                    </h2>
                    <p className="text-slate-300 mb-0 leading-relaxed text-sm sm:text-base">
                      導入塾50,000円のプロフェッショナル仕様エンジンを、<br className="hidden sm:block" />
                      ご家庭向けに最適化しました。<br />
                      （※学習塾・教育機関様向けのプランもございます）
                    </p>
                  </div>
                  <div className="md:w-2/5 text-center md:text-right shrink-0">
                    <Link
                      href="https://10snap.win/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex flex-col items-center justify-center w-full px-6 py-4 rounded-2xl bg-slate-700 hover:bg-slate-600 text-white font-bold border border-slate-500 transition-all shadow-lg hover:shadow-xl group-hover:-translate-y-1"
                    >
                      <span className="flex items-center gap-2 mb-1">
                        学習塾・法人様向け詳細
                        <ArrowRight className="h-5 w-5 text-blue-400" />
                      </span>
                      <span className="text-xs font-normal text-slate-400">10snap.win</span>
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="border-t border-orange-100/50 bg-gradient-to-b from-[#fffefc] to-orange-50/50">
            <div className="mx-auto flex w-full max-w-6xl flex-col items-center px-4 py-24 text-center sm:px-6">
              <h2 className="text-3xl font-extrabold sm:text-4xl text-slate-800">
                まずは2週間、<br className="sm:hidden" />
                家庭用TENsNAPを体験
              </h2>
              <p className="mt-6 text-lg text-slate-600 font-medium">自動更新なし。必要な時に、安心して始められます。</p>
              <Link
                href="/login"
                className="mt-10 inline-flex min-h-[3.5rem] items-center justify-center rounded-[2rem] bg-orange-500 px-10 py-5 text-lg font-bold text-white shadow-xl shadow-orange-200/80 transition-all hover:scale-105 hover:bg-orange-600"
              >
                まずは無料でお試し
              </Link>
            </div>
          </section>
        </main>
      </div>

      <footer className="border-t border-orange-100/50 py-10 relative z-10 bg-[#fffcf8]">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-6 px-4 text-sm font-medium text-slate-500 sm:flex-row sm:px-6">
          <p>&copy; {new Date().getFullYear()} TENsNAP 家庭用</p>
          <div className="flex items-center gap-6">
            <Link href="/legal/terms" className="hover:text-orange-600 transition-colors">
              利用規約
            </Link>
            <Link href="/legal/privacy" className="hover:text-orange-600 transition-colors">
              プライバシーポリシー
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
