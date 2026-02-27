import { query } from "@/lib/db";

export type AccountPlan = "school" | "family";

const DEFAULT_FAMILY_HOST = "family.10snap.win";

function normalizeHost(raw: string | null): string {
  if (!raw) return "";
  return raw.toLowerCase().split(",")[0].trim().replace(/:\d+$/, "");
}

function getFamilyHosts(): Set<string> {
  const configured = process.env.FAMILY_HOSTS || process.env.FAMILY_HOST || DEFAULT_FAMILY_HOST;
  const hosts = configured
    .split(",")
    .map((h) => normalizeHost(h))
    .filter(Boolean);
  return new Set(hosts);
}

export function getRequestHost(request: Request): string {
  return normalizeHost(
    request.headers.get("x-forwarded-host") || request.headers.get("host")
  );
}

export function getRequestedPlanFromRequest(request: Request): AccountPlan {
  const host = getRequestHost(request);
  return getFamilyHosts().has(host) ? "family" : "school";
}

export function isFamilyRequest(request: Request): boolean {
  return getRequestedPlanFromRequest(request) === "family";
}

export async function getOrganizationAccountPlan(orgId: string): Promise<AccountPlan> {
  const result = await query<{ account_plan: string | null }>(
    `SELECT account_plan FROM organizations WHERE id = $1`,
    [orgId]
  );
  const raw = (result.rows[0]?.account_plan || "school").toLowerCase();
  return raw === "family" ? "family" : "school";
}

