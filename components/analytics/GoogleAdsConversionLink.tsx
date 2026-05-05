"use client";

import Link from "next/link";
import type { ComponentProps, MouseEvent, ReactNode } from "react";

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

const GOOGLE_ADS_CTA_CONVERSION_SEND_TO =
  process.env.NEXT_PUBLIC_GOOGLE_ADS_CTA_CONVERSION_SEND_TO ||
  "AW-992335696/lCi3CJDm5OQCENCul9kD";

type Props = Omit<ComponentProps<typeof Link>, "href" | "onClick" | "children"> & {
  href: string;
  children: ReactNode;
};

export default function GoogleAdsConversionLink({
  href,
  children,
  target,
  ...props
}: Props) {
  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey ||
      target === "_blank"
    ) {
      return;
    }

    if (!window.gtag) return;

    event.preventDefault();

    let navigated = false;
    const navigate = () => {
      if (navigated) return;
      navigated = true;
      window.location.assign(href);
    };

    window.setTimeout(navigate, 1000);
    window.gtag("event", "conversion", {
      send_to: GOOGLE_ADS_CTA_CONVERSION_SEND_TO,
      event_callback: navigate,
    });
  };

  return (
    <Link href={href} target={target} onClick={handleClick} {...props}>
      {children}
    </Link>
  );
}
