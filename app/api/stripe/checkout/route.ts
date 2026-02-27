import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getTenantId } from "@/lib/tenant";
import { getOrganizationAccountPlan, getRequestedPlanFromRequest } from "@/lib/accountPlan";

function getErrorMessage(error: unknown) {
    if (error instanceof Error) return error.message;
    if (typeof error === "string") return error;
    return "Unknown error";
}

function addCheckoutParams(baseUrl: string, params: Record<string, string | undefined>) {
    const url = new URL(baseUrl);
    for (const [key, value] of Object.entries(params)) {
        if (value && value.trim() !== "") {
            url.searchParams.set(key, value);
        }
    }
    return url.toString();
}

export async function POST(request: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || !session.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const requestedPlan = getRequestedPlanFromRequest(request);

        // 1. Resolve Organization
        const orgId = await getTenantId(session.user.id, session.user.email, requestedPlan);
        const accountPlan = await getOrganizationAccountPlan(orgId);
        const isFamilyPlan = requestedPlan === "family" || accountPlan === "family";

        const schoolSubscriptionBase = process.env.STRIPE_SCHOOL_SUBSCRIPTION_LINK
            || "https://buy.stripe.com/7sY7sLfIX7KVduVgvT9fW00";
        const familySubscriptionBase = process.env.STRIPE_FAMILY_SUBSCRIPTION_LINK
            || "https://buy.stripe.com/5kQeVd1S77KV62tcfD9fW01";
        const schoolSetupBase = process.env.STRIPE_SCHOOL_SETUP_FEE_LINK
            || "https://buy.stripe.com/4gM3cvdAP9T39eF1AZ9fW02";

        const commonParams = {
            prefilled_email: session.user.email || undefined,
            client_reference_id: orgId,
        };

        if (isFamilyPlan) {
            return NextResponse.json({
                url: addCheckoutParams(familySubscriptionBase, commonParams),
                plan: "family",
            });
        }

        return NextResponse.json({
            url: addCheckoutParams(schoolSubscriptionBase, commonParams),
            setupFeeUrl: addCheckoutParams(schoolSetupBase, commonParams),
            plan: "school",
        });

    } catch (error: unknown) {
        console.error("Stripe Checkout Error:", error);
        return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
    }
}
