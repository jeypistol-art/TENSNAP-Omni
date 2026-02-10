import { getDeviceId } from "@/lib/deviceId";

export type AuthorizationResponse = { authorized: boolean };

// Calls the authorization API and returns a strict boolean response.
export async function authorize(accountId: string): Promise<AuthorizationResponse> {
  try {
    const deviceId = getDeviceId();
    const response = await fetch("/api/authorize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accountId, deviceId }),
    });

    const data = (await response.json()) as Partial<AuthorizationResponse>;
    if (typeof data.authorized === "boolean") {
      return { authorized: data.authorized };
    }
  } catch {
    // Silent failure: treat as unauthorized.
  }

  return { authorized: false };
}
