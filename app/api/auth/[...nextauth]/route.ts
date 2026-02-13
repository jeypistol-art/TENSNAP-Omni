import NextAuth, { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import EmailProvider from "next-auth/providers/email";
import { CustomPostgresAdapter } from "@/lib/custom-adapter";
import { query } from "@/lib/db";
import { randomUUID } from "crypto";

export const authOptions: NextAuthOptions = {
  adapter: CustomPostgresAdapter(),
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
    async jwt({ token, user, trigger }) {
      if (user?.id) {
        token.accountId = user.id;
      } else if (!token.accountId && token.sub) {
        token.accountId = token.sub;
      }

      // 1. On Sign In: Generate & Save Session ID (Kickout others)
      if (trigger === "signIn" && user) {
        const accountId = user.id || (token.accountId as string) || token.sub;
        if (!accountId) {
          console.error("SignIn callback missing account id");
          return token;
        }
        const sessionId = randomUUID();
        // Update DB with this new Session ID
        // We also ensure user exists or update it if needed (though Google Provider ensures auth success)
        await query(
          `UPDATE users SET current_session_id = $1 WHERE id = $2`,
          [sessionId, accountId]
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
              // Force Sign Out by returning null session (or handling in client)
              // NextAuth doesn't easily let us return 'null' here to kill session cookie deeply,
              // but returning an empty user or specific error flag works for client-side handling.
              // We'll set an error flag.
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
  },
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
