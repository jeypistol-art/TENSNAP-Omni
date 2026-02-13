"use client";

import { useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { authorize } from "@/lib/authorize";

export function useAuthorization(accountId?: string | null) {
  const router = useRouter();
  const inFlight = useRef(false);
  const signingOut = useRef(false);

  const handleUnauthorized = useCallback(async () => {
    if (signingOut.current) return;
    signingOut.current = true;
    clearClientSession();
    try {
      await signOut({ callbackUrl: "/login" });
    } catch {
      router.replace("/login");
    }
  }, [router]);

  const authorizeNow = useCallback(async () => {
    if (!accountId || inFlight.current) {
      return;
    }
    inFlight.current = true;
    try {
      const result = await authorize(accountId);
      if (!result.authorized) {
        await handleUnauthorized();
      }
    } finally {
      inFlight.current = false;
    }
  }, [accountId, handleUnauthorized]);

  useEffect(() => {
    void authorizeNow();
  }, [authorizeNow]);

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void authorizeNow();
      }
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [authorizeNow]);

  return { authorizeNow };
}

function clearClientSession() {
  if (typeof document === "undefined") {
    return;
  }

  try {
    sessionStorage.clear();
  } catch {
    // Best-effort cleanup only.
  }

  const cookies = document.cookie.split(";").map((cookie) => cookie.trim());
  for (const cookie of cookies) {
    if (!cookie) {
      continue;
    }
    const name = cookie.split("=")[0];
    document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
  }
}
