"use client";

import { useAuthorization } from "@/hooks/useAuthorization";

type AuthorizationClientProps = {
  accountId?: string | null;
};

export default function AuthorizationClient({
  accountId,
}: AuthorizationClientProps) {
  useAuthorization(accountId);
  return null;
}
