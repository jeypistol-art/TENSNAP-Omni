import NextAuth, { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import EmailProvider from "next-auth/providers/email";
import { CustomPostgresAdapter } from "@/lib/custom-adapter";
import { query } from "@/lib/db";
import { randomUUID } from "crypto";

function normalizeHost(raw: string): string {
  return raw.toLowerCase().trim().replace(/:\d+$/, "");
}

function getAllowedRedirectHosts(baseUrl: string): Set<string> {
  const hosts = new Set<string>();
  try {
    hosts.add(normalizeHost(new URL(baseUrl).host));
  } catch {
    // no-op
  }

  const familyHostsRaw = process.env.FAMILY_HOSTS || process.env.FAMILY_HOST || "family.10snap.win";
  for (const host of familyHostsRaw.split(",")) {
    const normalized = normalizeHost(host);
    if (normalized) hosts.add(normalized);
  }

  return hosts;
}

function getSharedCookieOptions() {
  const cookieDomain = process.env.NEXTAUTH_COOKIE_DOMAIN;
  if (!cookieDomain) {
    return undefined;
  }

  const useSecureCookie = process.env.NODE_ENV === "production";
  const sessionTokenName = useSecureCookie
    ? "__Secure-next-auth.session-token"
    : "next-auth.session-token";
  const callbackUrlName = useSecureCookie
    ? "__Secure-next-auth.callback-url"
    : "next-auth.callback-url";
  const csrfTokenName = useSecureCookie
    ? "__Host-next-auth.csrf-token"
    : "next-auth.csrf-token";

  return {
    sessionToken: {
      name: sessionTokenName,
      options: {
        httpOnly: true,
        sameSite: "lax" as const,
        path: "/",
        secure: useSecureCookie,
        domain: cookieDomain,
      },
    },
    callbackUrl: {
      name: callbackUrlName,
      options: {
        sameSite: "lax" as const,
        path: "/",
        secure: useSecureCookie,
        domain: cookieDomain,
      },
    },
    csrfToken: {
      name: csrfTokenName,
      options: {
        httpOnly: true,
        sameSite: "lax" as const,
        path: "/",
        secure: useSecureCookie,
        // Keep default host-only behavior in production when using __Host- cookie.
      },
    },
  };
}

export const authOptions: NextAuthOptions = {
  adapter: CustomPostgresAdapter(),
  cookies: getSharedCookieOptions(),
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    EmailProvider({
      server: {
        host: process.env.EMAIL_SERVER_HOST,
        port: Number(process.env.EMAIL_SERVER_PORT),
        auth: {
          user: process.env.EMAIL_SERVER_USER,
          pass: process.env.EMAIL_SERVER_PASSWORD,
        },
      },
      from: process.env.EMAIL_FROM,
    }),
  ],
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async jwt({ token, user, account }) {
      if (user?.id) {
        token.accountId = user.id;
      } else if (!token.accountId && token.sub) {
        token.accountId = token.sub;
      }

      // Rotate session id only during actual sign-in handshake.
      // OAuth can invoke jwt callback multiple times; gating by `account`
      // prevents accidental extra rotation that can cause first-login mismatch.
      if (user && account) {
        const accountId = user.id || (token.accountId as string) || token.sub;
        if (!accountId) {
          console.error("SignIn callback missing account id");
          return token;
        }
        const sessionId = randomUUID();
        // Upsert prevents first-login race where users row is not yet visible.
        await query(
          `INSERT INTO users (id, email, current_session_id)
           VALUES ($1, $2, $3)
           ON CONFLICT (id)
           DO UPDATE SET
             current_session_id = EXCLUDED.current_session_id,
             email = COALESCE(users.email, EXCLUDED.email)`,
          [accountId, user.email ?? null, sessionId]
        );
        token.sessionId = sessionId;
        token.accountId = accountId;
      }
      return token;
    },
    async session({ session, token }) {
      const accountId = (token.accountId as string) || token.sub;
      if (session.user && accountId) {
        session.user.id = accountId;

        // 2. Strict Session Check (The Guard)
        // Every time the session is accessed, we check if it matches the DB.
        // If not, it means a NEW session was created elsewhere (Kickout).
        try {
          const result = await query<{ current_session_id: string }>(
            `SELECT current_session_id FROM users WHERE id = $1`,
            [accountId]
          );

          if (result.rows.length > 0) {
            const dbSessionId = result.rows[0].current_session_id;
            // If DB says "Session B" but I am "Session A", I am invalid.
            if (dbSessionId && dbSessionId !== token.sessionId) {
              // Self-heal once to absorb transient read/write races right after login.
              // If another session already moved the value meanwhile, this returns 0 rows
              // and we still force logout.
              const tokenSessionId = typeof token.sessionId === "string" ? token.sessionId : "";
              if (tokenSessionId) {
                const takeover = await query<{ id: string }>(
                  `UPDATE users
                   SET current_session_id = $1
                   WHERE id = $2 AND current_session_id = $3
                   RETURNING id`,
                  [tokenSessionId, accountId, dbSessionId]
                );
                if (takeover.rows.length > 0) {
                  return session;
                }
              }
              return { ...session, error: "ForceLogout" };
            }
          }
        } catch (err) {
          console.error("Session validation failed:", err);
        }
      } else if (session.user) {
        console.error("Session callback missing account id");
        return { ...session, error: "ForceLogout" };
      }
      return session;
    },
    async redirect({ url, baseUrl }) {
      // Keep users on their current tenant host (e.g. family.10snap.win) after auth.
      if (url.startsWith("/")) {
        return `${baseUrl}${url}`;
      }

      try {
        const target = new URL(url);
        const allowedHosts = getAllowedRedirectHosts(baseUrl);
        if (allowedHosts.has(normalizeHost(target.host))) {
          return target.toString();
        }
      } catch {
        // fall through
      }

      return baseUrl;
    },
  },
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
