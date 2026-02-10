import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { stripe } from "@/lib/stripe";
import { query } from "@/lib/db";
import { getTenantId } from "@/lib/tenant";

const PRODUCT_IDS = {
    SETUP_FEE: "prod_Tv7PUAuavY1I1s", // 50,000 JPY
    MONTHLY: "prod_Tv7RHfcj9WrCP5",   // 9,800 JPY
};

async function getPriceIdForProduct(productId: string) {
    const prices = await stripe.prices.list({ product: productId, active: true, limit: 1 });
    if (prices.data.length === 0) {
        throw new Error(`No price found for product ${productId}`);
    }
    return prices.data[0].id;
}

export async function POST(request: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || !session.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // 1. Resolve Organization
        const orgId = await getTenantId(session.user.id, session.user.email);

        // 2. Fetch Organization Details (for Created At check)
        const orgRes = await query<{ created_at: Date, stripe_customer_id: string }>(
            `SELECT created_at, stripe_customer_id FROM organizations WHERE id = $1`,
            [orgId]
        );
        const org = orgRes.rows[0];

        // 3. Early Bird Check (7 Days)
        const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;
        const isEarlyBird = (new Date().getTime() - new Date(org.created_at).getTime()) < ONE_WEEK_MS;

        // 4. Resolve Prices
        // HARDCODED IDs to prevent resolution errors (User provided these)
        // Monthly: prod_Tv7RHfcj9WrCP5
        // Setup: prod_Tv7PUAuavY1I1s

        let monthlyPriceId = "";
        let setupPriceId = "";

        try {
            // Try to find price for Monthly (Recurring)
            // ENFORCE recurring: true to ensure we satisfy subscription mode requirements
            const mPrices = await stripe.prices.list({
                product: "prod_Tv7RHfcj9WrCP5",
                active: true,
                limit: 1,
                type: 'recurring'
            });
            if (mPrices.data.length > 0) monthlyPriceId = mPrices.data[0].id;

            // Try to find price for Setup (One-time)
            const sPrices = await stripe.prices.list({
                product: "prod_Tv7PUAuavY1I1s",
                active: true,
                limit: 1,
                type: 'one_time'
            });
            if (sPrices.data.length > 0) setupPriceId = sPrices.data[0].id;

            console.log("Resolved Prices:", { monthly: monthlyPriceId, setup: setupPriceId });
        } catch (e) {
            console.error("Price resolution failed:", e);
        }

        if (!monthlyPriceId) throw new Error("Monthly Price ID not found for prod_Tv7RHfcj9WrCP5");
        if (!setupPriceId) throw new Error("Setup Price ID not found for prod_Tv7PUAuavY1I1s");

        // 5. Construct Checkout Params
        // Redirect to root because Dashboard is at /
        const successUrl = `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/?payment=success`;
        const cancelUrl = `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/?payment=cancelled`;

        const checkoutParams: any = {
            mode: 'subscription',
            payment_method_types: ['card'],
            line_items: [
                { price: setupPriceId, quantity: 1 },
                { price: monthlyPriceId, quantity: 1 },
            ],
            success_url: successUrl,
            cancel_url: cancelUrl,
            metadata: {
                organization_id: orgId,
                user_id: session.user.id
            },
            customer_email: session.user.email || undefined,
            client_reference_id: orgId,
            // allow_promotion_codes: true, // ERROR: Cannot mix with discounts
        };

        // Reuse Customer if exists
        if (org.stripe_customer_id) {
            checkoutParams.customer = org.stripe_customer_id;
            delete checkoutParams.customer_email; // Cannot set both
        }

        // 6. Apply Early Bird Discount (Initial Fee 50% OFF)
        if (isEarlyBird) {
            // Use static coupon defined in Stripe Dashboard
            // ID: EARLY_BIRD_50
            checkoutParams.discounts = [{ coupon: 'EARLY_BIRD_50' }];
        } else {
            // Only allow codes if no discount is manually applied
            checkoutParams.allow_promotion_codes = true;
        }

        const checkoutSession = await stripe.checkout.sessions.create(checkoutParams);

        return NextResponse.json({ url: checkoutSession.url });

    } catch (error: any) {
        console.error("Stripe Checkout Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
