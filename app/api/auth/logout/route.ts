import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { query } from "@/lib/db";

export async function POST() {
    const response = NextResponse.json({ success: true });
    const useSecureCookie = process.env.NODE_ENV === "production";
    const cookieDomain = process.env.NEXTAUTH_COOKIE_DOMAIN;

    const cookieNames = [
        "__Secure-next-auth.session-token",
        "next-auth.session-token",
        "__Secure-authjs.session-token",
        "authjs.session-token",
        "__Secure-next-auth.callback-url",
        "next-auth.callback-url",
        "__Secure-authjs.callback-url",
        "authjs.callback-url",
        "__Host-next-auth.csrf-token",
        "next-auth.csrf-token",
        "__Host-authjs.csrf-token",
        "authjs.csrf-token",
        "__Secure-next-auth.state",
        "next-auth.state",
        "__Secure-authjs.state",
        "authjs.state",
        "__Secure-next-auth.pkce.code_verifier",
        "next-auth.pkce.code_verifier",
        "__Secure-authjs.pkce.code_verifier",
        "authjs.pkce.code_verifier",
        "__Secure-next-auth.nonce",
        "next-auth.nonce",
        "__Secure-authjs.nonce",
        "authjs.nonce",
    ];

    const expireCookie = (name: string, domain?: string) => {
        response.cookies.set({
            name,
            value: "",
            path: "/",
            expires: new Date(0),
            sameSite: "lax",
            secure: useSecureCookie,
            httpOnly: true,
            ...(domain ? { domain } : {}),
        });
    };

    for (const name of cookieNames) {
        // Host-only delete
        expireCookie(name);
        // Domain-scope delete (not allowed for __Host- cookies)
        if (cookieDomain && !name.startsWith("__Host-")) {
            expireCookie(name, cookieDomain);
        }
    }

    try {
        const session = await getServerSession(authOptions);
        if (session?.user?.id) {
            await query(
                `UPDATE users SET current_session_id = NULL WHERE id = $1`,
                [session.user.id]
            );
        }
    } catch (error) {
        console.error("Logout Cleanup Error:", error);
    }
    return response;
}
