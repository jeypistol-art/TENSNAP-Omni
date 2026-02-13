import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { stripe } from "@/lib/stripe";
import { query } from "@/lib/db";
import { getTenantId } from "@/lib/tenant";

function getErrorMessage(error: unknown) {
    if (error instanceof Error) return error.message;
    if (typeof error === "string") return error;
    return "Unknown error";
}

export async function POST(request: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const orgId = await getTenantId(session.user.id, session.user.email);
        const orgRes = await query<{ stripe_customer_id: string | null }>(
            `SELECT stripe_customer_id FROM organizations WHERE id = $1`,
            [orgId]
        );
        const customerId = orgRes.rows[0]?.stripe_customer_id;
        if (!customerId) {
            return NextResponse.json(
                { error: "Stripe customer is not linked yet. Complete checkout first." },
                { status: 400 }
            );
        }

        const fallbackOrigin = new URL(request.url).origin;
        const baseUrl = process.env.NEXTAUTH_URL || fallbackOrigin;
        const portalSession = await stripe.billingPortal.sessions.create({
            customer: customerId,
            return_url: `${baseUrl}/settings`,
        });

        return NextResponse.json({ url: portalSession.url });
    } catch (error: unknown) {
        console.error("Stripe portal session error:", error);
        return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
    }
}

