"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

type Props = {
  measurementId: string;
};

export default function GoogleAnalyticsPageView({ measurementId }: Props) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!pathname) return;

    const query = searchParams?.toString();
    const pagePath = query ? `${pathname}?${query}` : pathname;
    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;

    const send = (attempt = 0) => {
      if (cancelled) return;
      if (window.gtag) {
        window.gtag("event", "page_view", {
          page_path: pagePath,
          page_location: window.location.href,
          send_to: measurementId,
        });
        return;
      }
      if (attempt < 10) {
        retryTimer = setTimeout(() => send(attempt + 1), 200);
      }
    };

    send();

    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [measurementId, pathname, searchParams]);

  return null;
}
