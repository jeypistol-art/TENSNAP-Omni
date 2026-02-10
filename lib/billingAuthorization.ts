import crypto from "crypto";

export type AuthorizationResult = { authorized: boolean };

export type Account = {
  accountId: string;
  isPremium: boolean;
  subscriptionExpiresAt: Date | null;
};

export type Device = {
  deviceId: string;
  accountId: string;
  lastUsedAt: Date;
  isActive: boolean;
};

export type Session = {
  sessionId: string;
  accountId: string;
  deviceId: string;
  startedAt: Date;
  expiresAt: Date;
};

export type AuthorizationInput = {
  accountId: string;
  deviceId: string;
  now?: Date;
  sessionTtlMs?: number;
};

export interface AccountStore {
  getAccount(accountId: string): Promise<Account | null>;
}

export interface DeviceStore {
  listDevices(accountId: string): Promise<Device[]>;
  getDevice(accountId: string, deviceId: string): Promise<Device | null>;
  createDevice(device: Device): Promise<void>;
  updateDevice(device: Device): Promise<void>;
}

export interface SessionStore {
  listActiveSessions(accountId: string, now: Date): Promise<Session[]>;
  expireSessions(sessionIds: string[], now: Date): Promise<void>;
  createSession(session: Session): Promise<void>;
}

export interface BillingStore {
  accounts: AccountStore;
  devices: DeviceStore;
  sessions: SessionStore;
  withAccountLock<T>(accountId: string, fn: () => Promise<T>): Promise<T>;
}

const DEFAULT_SESSION_TTL_MS = 60 * 60 * 1000;
const MAX_DEVICES = 2;

// Orchestrates the single authorization flow and returns a strict true/false.
export async function authorizeBilling(
  store: BillingStore,
  input: AuthorizationInput
): Promise<AuthorizationResult> {
  const now = input.now ?? new Date();
  const sessionTtlMs = input.sessionTtlMs ?? DEFAULT_SESSION_TTL_MS;

  return store.withAccountLock(input.accountId, async () => {
    // 1) Account fetch + paid check.
    const account = await store.accounts.getAccount(input.accountId);
    if (!account || !isAccountPaid(account, now)) {
      return { authorized: false };
    }

    // 2) Device validation/registration.
    await ensureDeviceAllowed(store.devices, input.accountId, input.deviceId, now);

    // 3) Session rotation.
    await rotateSession(store.sessions, input.accountId, input.deviceId, now, sessionTtlMs);

    return { authorized: true };
  });
}

// Returns true only when subscription is currently valid.
export function isAccountPaid(account: Account, now: Date): boolean {
  if (!account.isPremium) {
    return false;
  }
  if (account.subscriptionExpiresAt && account.subscriptionExpiresAt <= now) {
    return false;
  }
  return true;
}

// Validates the current device and updates registration state.
export async function ensureDeviceAllowed(
  devices: DeviceStore,
  accountId: string,
  deviceId: string,
  now: Date
): Promise<void> {
  const existing = await devices.getDevice(accountId, deviceId);
  if (existing) {
    await touchDevice(devices, existing, now);
    return;
  }

  const registered = (await devices.listDevices(accountId)).filter((d) => d.isActive);
  if (registered.length >= MAX_DEVICES) {
    const oldest = findOldestDevice(registered);
    if (oldest) {
      await devices.updateDevice({ ...oldest, isActive: false });
    }
  }

  const created: Device = {
    deviceId,
    accountId,
    lastUsedAt: now,
    isActive: true,
  };
  await devices.createDevice(created);
}

// Centralized device touch to keep lastUsedAt updates consistent.
export async function touchDevice(
  devices: DeviceStore,
  device: Device,
  now: Date
): Promise<void> {
  const updated: Device = {
    ...device,
    isActive: true,
    lastUsedAt: now,
  };
  await devices.updateDevice(updated);
}

// Enforces single-session behavior while always issuing a new session.
export async function rotateSession(
  sessions: SessionStore,
  accountId: string,
  deviceId: string,
  now: Date,
  sessionTtlMs: number
): Promise<void> {
  const active = await sessions.listActiveSessions(accountId, now);
  if (active.length > 0) {
    await sessions.expireSessions(
      active.map((session) => session.sessionId),
      now
    );
  }

  const session: Session = {
    sessionId: crypto.randomUUID(),
    accountId,
    deviceId,
    startedAt: now,
    expiresAt: new Date(now.getTime() + sessionTtlMs),
  };
  await sessions.createSession(session);
}

function findOldestDevice(devices: Device[]): Device | null {
  if (devices.length === 0) {
    return null;
  }
  return devices.reduce((oldest, current) =>
    current.lastUsedAt < oldest.lastUsedAt ? current : oldest
  );
}

class AsyncLock {
  private chain: Promise<void> = Promise.resolve();

  async run<T>(fn: () => Promise<T>): Promise<T> {
    const prior = this.chain;
    let release!: () => void;
    this.chain = new Promise<void>((resolve) => {
      release = resolve;
    });
    await prior;
    try {
      return await fn();
    } finally {
      release();
    }
  }
}

// In-memory store for local use and tests; replace with a persistent store in production.
export class InMemoryBillingStore implements BillingStore {
  public accounts: AccountStore;
  public devices: DeviceStore;
  public sessions: SessionStore;

  private readonly accountMap = new Map<string, Account>();
  private readonly deviceMap = new Map<string, Device[]>();
  private readonly sessionMap = new Map<string, Session[]>();
  private readonly locks = new Map<string, AsyncLock>();

  constructor(seed?: { accounts?: Account[]; devices?: Device[]; sessions?: Session[] }) {
    seed?.accounts?.forEach((account) => this.accountMap.set(account.accountId, account));
    seed?.devices?.forEach((device) => {
      const list = this.deviceMap.get(device.accountId) ?? [];
      list.push(device);
      this.deviceMap.set(device.accountId, list);
    });
    seed?.sessions?.forEach((session) => {
      const list = this.sessionMap.get(session.accountId) ?? [];
      list.push(session);
      this.sessionMap.set(session.accountId, list);
    });

    this.accounts = {
      getAccount: async (accountId) => this.accountMap.get(accountId) ?? null,
    };

    this.devices = {
      listDevices: async (accountId) => [...(this.deviceMap.get(accountId) ?? [])],
      getDevice: async (accountId, deviceId) =>
        (this.deviceMap.get(accountId) ?? []).find((d) => d.deviceId === deviceId) ?? null,
      createDevice: async (device) => {
        const list = this.deviceMap.get(device.accountId) ?? [];
        list.push(device);
        this.deviceMap.set(device.accountId, list);
      },
      updateDevice: async (device) => {
        const list = this.deviceMap.get(device.accountId) ?? [];
        const index = list.findIndex((d) => d.deviceId === device.deviceId);
        if (index >= 0) {
          list[index] = device;
          this.deviceMap.set(device.accountId, list);
        }
      },
    };

    this.sessions = {
      listActiveSessions: async (accountId, now) => {
        const list = this.sessionMap.get(accountId) ?? [];
        return list.filter((session) => session.expiresAt > now);
      },
      expireSessions: async (sessionIds, now) => {
        if (sessionIds.length === 0) {
          return;
        }
        const ids = new Set(sessionIds);
        for (const [accountId, sessions] of this.sessionMap.entries()) {
          let touched = false;
          const updated = sessions.map((session) => {
            if (!ids.has(session.sessionId)) {
              return session;
            }
            touched = true;
            return { ...session, expiresAt: now };
          });
          if (touched) {
            this.sessionMap.set(accountId, updated);
          }
        }
      },
      createSession: async (session) => {
        const list = this.sessionMap.get(session.accountId) ?? [];
        list.push(session);
        this.sessionMap.set(session.accountId, list);
      },
    };
  }

  async withAccountLock<T>(accountId: string, fn: () => Promise<T>): Promise<T> {
    const lock = this.locks.get(accountId) ?? new AsyncLock();
    this.locks.set(accountId, lock);
    return lock.run(fn);
  }
}
