import { NextResponse } from "next/server";
import {
  authorizeBilling,
  InMemoryBillingStore,
} from "@/lib/billingAuthorization";

// NOTE: In-memory store for development only. Replace with persistent store in production.
const store = new InMemoryBillingStore();
const billingAuthEnabled = process.env.BILLING_AUTH_ENABLED === "true";

// POST /api/authorize
export async function POST(request: Request) {
  // Default allow unless billing auth is explicitly enabled.
  // Current in-memory store is non-persistent and will deny users on refresh/redeploy.
  if (!billingAuthEnabled) {
    return NextResponse.json({ authorized: true });
  }

  try {
    const payload = (await request.json()) as {
      accountId?: unknown;
      deviceId?: unknown;
    };

    const accountId = normalizeId(payload.accountId);
    const deviceId = normalizeId(payload.deviceId);

    if (!accountId || !deviceId) {
      return NextResponse.json({ authorized: false });
    }

    const result = await authorizeBilling(store, { accountId, deviceId });
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ authorized: false });
  }
}

function normalizeId(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}
