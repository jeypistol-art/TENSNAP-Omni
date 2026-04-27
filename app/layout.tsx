import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Suspense } from "react";
import "./globals.css";
import Providers from "@/components/Providers";
import Script from "next/script";
import GoogleAnalyticsPageView from "@/components/analytics/GoogleAnalyticsPageView";

const GA_MEASUREMENT_ID = "G-SPR3EGLY0M";
const GOOGLE_ADS_ID = "AW-992335696";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL('https://10snap.win'),
  verification: {
    google: "oXmtpk3k_N2IrgZAbLOTf02FxsWrBx-akIFotvawfAg",
  },
  title: {
    default: 'TENsNAP・Omni | 学習理解度を可視化・指導を改善する分析支援システム',
    template: '%s | TENsNAP・Omni'
  },
  description: '採点後の答案用紙をスキャンするだけで、AIが生徒の成長率や弱点を解析。塾講師の業務を劇的に効率化し、次の一手を見える化します。',
  openGraph: {
    type: 'website',
    locale: 'ja_JP',
    url: 'https://10snap.win',
    siteName: 'TENsNAP・Omni',
    images: [
      {
        url: '/images/og-image.png',
        width: 1200,
        height: 630,
        alt: 'TENsNAP・Omni - AI教育分析支援',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'TENsNAP・Omni',
    description: 'AIが答案を解析し、指導を支える。',
    images: ['/images/og-image.png'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        <Providers>{children}</Providers>
        <Suspense fallback={null}>
          <GoogleAnalyticsPageView measurementId={GA_MEASUREMENT_ID} />
        </Suspense>
        <Script
          src={`https://www.googletagmanager.com/gtag/js?id=${GOOGLE_ADS_ID}`}
          strategy="beforeInteractive"
        />
        <Script id="google-analytics" strategy="beforeInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());

            gtag('config', '${GA_MEASUREMENT_ID}', { send_page_view: false });
            gtag('config', '${GOOGLE_ADS_ID}');
          `}
        </Script>
      </body>
    </html>
  );
}
