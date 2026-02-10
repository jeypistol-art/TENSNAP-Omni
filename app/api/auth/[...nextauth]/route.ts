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
      // 1. On Sign In: Generate & Save Session ID (Kickout others)
      if (trigger === "signIn" && user) {
        const sessionId = randomUUID();
        // Update DB with this new Session ID
        // We also ensure user exists or update it if needed (though Google Provider ensures auth success)
        await query(
          `UPDATE users SET current_session_id = $1 WHERE id = $2`,
          [sessionId, user.id]
        );
        token.sessionId = sessionId;
        token.accountId = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.accountId as string;

        // 2. Strict Session Check (The Guard)
        // Every time the session is accessed, we check if it matches the DB.
        // If not, it means a NEW session was created elsewhere (Kickout).
        const result = await query<{ current_session_id: string }>(
          `SELECT current_session_id FROM users WHERE id = $1`,
          [token.accountId]
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
      }
      return session;
    },
  },
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
