const DEVICE_ID_KEY = "score-snap:v1:deviceId";

// Returns a stable device identifier stored in localStorage when available.
export function getDeviceId(): string {
  if (typeof window === "undefined") {
    return crypto.randomUUID();
  }

  try {
    const existing = window.localStorage.getItem(DEVICE_ID_KEY);
    if (existing) {
      return existing;
    }
    const generated = crypto.randomUUID();
    window.localStorage.setItem(DEVICE_ID_KEY, generated);
    return generated;
  } catch {
    return crypto.randomUUID();
  }
}
