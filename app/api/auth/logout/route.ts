import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { query } from "@/lib/db";

async function clearAuthCookies(request: Request, response: NextResponse) {
    const useSecureCookie = process.env.NODE_ENV === "production";
    const cookieDomain = process.env.NEXTAUTH_COOKIE_DOMAIN;

    const cookiePrefixes = [
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

    const requestCookies = request.headers.get("cookie") || "";
    const requestCookieNames = requestCookies
        .split(";")
        .map((part) => part.trim().split("=")[0]?.trim())
        .filter((name): name is string => !!name);

    const cookieNames = Array.from(new Set([
        ...cookiePrefixes,
        ...requestCookieNames.filter((name) =>
            cookiePrefixes.some((prefix) => name === prefix || name.startsWith(`${prefix}.`))
        ),
    ]));

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
}

export async function POST(request: Request) {
    const response = NextResponse.json({ success: true });
    await clearAuthCookies(request, response);
    return response;
}

export async function GET(request: Request) {
    const { searchParams, origin } = new URL(request.url);
    const callbackUrl = searchParams.get("callbackUrl") || "/";
    const redirectUrl = new URL(callbackUrl, origin);
    const response = NextResponse.redirect(redirectUrl);
    await clearAuthCookies(request, response);
    return response;
}
